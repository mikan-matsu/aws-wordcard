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
// 代案として、DynamoDBをon-demandからprovisioned容量へ変更し、AWSアカウント全体で
// 永続無料の25RCU+25WCU枠に通常時は収まるようにする。容量モード変更はテーブルの
// 作り直しを伴わない(= 既存データは消えない)非破壊的な更新であることをsandboxで
// 実機検証済み。
//
// 【オートスケーリングはWordテーブルの読み取り(RCU)にのみ絞る】
// Wordモデルはpublic API keyにread権限しか与えておらず(data/resource.ts参照)、
// 外部から書き込むことはできない。WordProgress/MyWordもCognitoログイン必須
// (owner権限)なので、匿名の連続アクセスで直接狙われるのは実質Word/GSIの読み取り
// だけ。他の容量(WCU全般、WordProgress/MyWord)は固定値のままで十分。
// オートスケーリングの1対象につきCloudWatchアラームが4個(AlarmHigh/Low,
// ProvisionedCapacityHigh/Low)自動生成され、アカウント全体で月10個まで無料・
// 超過分は$0.10/個/月かかる。対象をWord本体+byStatus GSIの読み取り2個に絞ることで
// 合計8個(=無料枠内)に収め、固定費を発生させない設計にしている。
const { amplifyDynamoDbTables } = backend.data.resources.cfnResources;

type CapacityRange = { min: number; max: number };
type FixedTableCapacity = {
  modelName: keyof typeof amplifyDynamoDbTables;
  read: number;
  write: number;
  gsi?: { indexName: string; read: number; write: number };
};

// 固定の読み取り/書き込み容量(実アクセス量: Wordテーブルが最大13RCU/分程度、
// MyWord/WordProgressはほぼゼロという実測値を踏まえる)
const FIXED_CAPACITY: FixedTableCapacity[] = [
  {
    modelName: 'Word',
    read: 5, // オートスケーリング対象のためここは初期値。実際の上限はREAD_SCALINGで管理
    write: 2,
    gsi: { indexName: 'byStatus', read: 5, write: 2 },
  },
  { modelName: 'WordProgress', read: 1, write: 1 },
  { modelName: 'MyWord', read: 1, write: 1 },
];

// オートスケーリング対象(読み取りのみ)
const READ_SCALING: { modelName: keyof typeof amplifyDynamoDbTables; gsiIndexName?: string; range: CapacityRange }[] = [
  { modelName: 'Word', range: { min: 5, max: 10 } },
  { modelName: 'Word', gsiIndexName: 'byStatus', range: { min: 5, max: 10 } },
];

const TARGET_UTILIZATION_PERCENT = 70;

for (const plan of FIXED_CAPACITY) {
  const table = amplifyDynamoDbTables[plan.modelName];
  table.billingMode = BillingMode.PROVISIONED;
  table.provisionedThroughput = { readCapacityUnits: plan.read, writeCapacityUnits: plan.write };
  if (plan.gsi) {
    table.setGlobalSecondaryIndexProvisionedThroughput(plan.gsi.indexName, {
      readCapacityUnits: plan.gsi.read,
      writeCapacityUnits: plan.gsi.write,
    });
  }
}

// オートスケーリング用のリソースは専用スタックにまとめる
// (Amplify Gen2のAmplifyDynamoDbTableWrapperには容量モード設定までしかなく、
// オートスケーリングのメソッドが無いため、aws-applicationautoscalingで直接構築する)
const scalingStack = backend.createStack('DynamoDbCapacityScaling');

for (const target of READ_SCALING) {
  const tableName = backend.data.resources.tables[target.modelName].tableName;
  const isIndex = Boolean(target.gsiIndexName);
  const resourceId = isIndex
    ? `table/${tableName}/index/${target.gsiIndexName}`
    : `table/${tableName}`;
  const idPrefix = isIndex ? `${target.modelName}${target.gsiIndexName}Gsi` : `${target.modelName}Table`;

  const readTarget = new ScalableTarget(scalingStack, `${idPrefix}ReadScaling`, {
    serviceNamespace: ServiceNamespace.DYNAMODB,
    resourceId,
    scalableDimension: isIndex ? 'dynamodb:index:ReadCapacityUnits' : 'dynamodb:table:ReadCapacityUnits',
    minCapacity: target.range.min,
    maxCapacity: target.range.max,
  });
  readTarget.scaleToTrackMetric(`${idPrefix}ReadTracking`, {
    predefinedMetric: PredefinedMetric.DYNAMODB_READ_CAPACITY_UTILIZATION,
    targetValue: TARGET_UTILIZATION_PERCENT,
  });
}
