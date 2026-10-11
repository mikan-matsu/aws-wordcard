import { defineBackend } from '@aws-amplify/backend';
import { BillingMode } from 'aws-cdk-lib/aws-dynamodb';
import { PredefinedMetric, ScalableTarget, ServiceNamespace } from 'aws-cdk-lib/aws-applicationautoscaling';
import { auth } from './auth/resource';
import { data } from './data/resource';

const backend = defineBackend({
  auth,
  data,
});

// 【連続アクセスによる課金対策】AppSync(GraphQL)にはAPI Gatewayのような無料の
// 組み込みスロットリングが無く、WAF(月1,000円前後)はコスト面でユーザーが却下済み。
// 代案として、DynamoDBをon-demandからprovisioned容量+オートスケーリングへ変更し、
// AWSアカウント全体で永続無料の25RCU+25WCU枠に通常時は収まるようにする。
// 容量モード変更はテーブルの作り直しを伴わない(= 既存データは消えない)非破壊的な
// 更新であることをsandboxで実機検証済み。
//
// 配分の考え方(実アクセス量: Wordテーブルが最大13RCU/分程度、MyWord/WordProgressは
// ほぼゼロという実測値を踏まえる):
//   Word(本体)        : RCU 5〜10 / WCU 2〜5  (読み取りが主、単語データは閲覧中心)
//   Word/byStatus GSI  : RCU 5〜10 / WCU 2〜5  (本体と同程度のアクセスを想定)
//   WordProgress       : RCU 1〜5  / WCU 1〜5  (ログインユーザー本人の進捗のみ、アクセス僅少)
//   MyWord             : RCU 1〜5  / WCU 1〜5  (同上)
// 最小値の合計はRCU12・WCU6で無料枠(25/25)に十分収まり、最大値まで一斉にスケールしても
// 超過分のみ課金されるだけなので、WAFの固定月額より安く済む想定。
const { amplifyDynamoDbTables } = backend.data.resources.cfnResources;

type CapacityRange = { min: number; max: number };
type TableCapacityPlan = {
  modelName: keyof typeof amplifyDynamoDbTables;
  read: CapacityRange;
  write: CapacityRange;
  gsi?: { indexName: string; read: CapacityRange; write: CapacityRange };
};

const CAPACITY_PLAN: TableCapacityPlan[] = [
  {
    modelName: 'Word',
    read: { min: 5, max: 10 },
    write: { min: 2, max: 5 },
    gsi: { indexName: 'byStatus', read: { min: 5, max: 10 }, write: { min: 2, max: 5 } },
  },
  {
    modelName: 'WordProgress',
    read: { min: 1, max: 5 },
    write: { min: 1, max: 5 },
  },
  {
    modelName: 'MyWord',
    read: { min: 1, max: 5 },
    write: { min: 1, max: 5 },
  },
];

const TARGET_UTILIZATION_PERCENT = 70;

// オートスケーリング用のリソースは専用スタックにまとめる
// (Amplify Gen2のAmplifyDynamoDbTableWrapperには容量モード設定までしかなく、
// オートスケーリングのメソッドが無いため、aws-applicationautoscalingで直接構築する)
const scalingStack = backend.createStack('DynamoDbCapacityScaling');

for (const plan of CAPACITY_PLAN) {
  const table = amplifyDynamoDbTables[plan.modelName];
  const tableName = backend.data.resources.tables[plan.modelName].tableName;

  table.billingMode = BillingMode.PROVISIONED;
  table.provisionedThroughput = {
    readCapacityUnits: plan.read.min,
    writeCapacityUnits: plan.write.min,
  };

  registerTableScaling(scalingStack, `${plan.modelName}Table`, `table/${tableName}`, plan.read, plan.write);

  if (plan.gsi) {
    table.setGlobalSecondaryIndexProvisionedThroughput(plan.gsi.indexName, {
      readCapacityUnits: plan.gsi.read.min,
      writeCapacityUnits: plan.gsi.write.min,
    });
    registerTableScaling(
      scalingStack,
      `${plan.modelName}${plan.gsi.indexName}Gsi`,
      `table/${tableName}/index/${plan.gsi.indexName}`,
      plan.gsi.read,
      plan.gsi.write,
      /* isIndex */ true,
    );
  }
}

function registerTableScaling(
  scope: typeof scalingStack,
  idPrefix: string,
  resourceId: string,
  read: CapacityRange,
  write: CapacityRange,
  isIndex = false,
) {
  const readTarget = new ScalableTarget(scope, `${idPrefix}ReadScaling`, {
    serviceNamespace: ServiceNamespace.DYNAMODB,
    resourceId,
    scalableDimension: isIndex ? 'dynamodb:index:ReadCapacityUnits' : 'dynamodb:table:ReadCapacityUnits',
    minCapacity: read.min,
    maxCapacity: read.max,
  });
  readTarget.scaleToTrackMetric(`${idPrefix}ReadTracking`, {
    predefinedMetric: PredefinedMetric.DYNAMODB_READ_CAPACITY_UTILIZATION,
    targetValue: TARGET_UTILIZATION_PERCENT,
  });

  const writeTarget = new ScalableTarget(scope, `${idPrefix}WriteScaling`, {
    serviceNamespace: ServiceNamespace.DYNAMODB,
    resourceId,
    scalableDimension: isIndex ? 'dynamodb:index:WriteCapacityUnits' : 'dynamodb:table:WriteCapacityUnits',
    minCapacity: write.min,
    maxCapacity: write.max,
  });
  writeTarget.scaleToTrackMetric(`${idPrefix}WriteTracking`, {
    predefinedMetric: PredefinedMetric.DYNAMODB_WRITE_CAPACITY_UTILIZATION,
    targetValue: TARGET_UTILIZATION_PERCENT,
  });
}
