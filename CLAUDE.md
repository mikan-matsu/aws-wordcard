# 運用ルール

## push頻度(Amplifyビルドコスト対策)
developへのpushは、1つの小さな修正ごとに毎回行うのではなく、**ある程度まとめてから**行うこと。
- 理由: developブランチへのpushはAmplifyの自動ビルドをトリガーする。1回のビルドで数分〜10分程度のビルド時間が課金され、細かい修正を都度pushすると月間のAmplifyコストが積み上がる(2026年9月には1日で10回近くビルドが走り、月間コストが予算アラートの閾値を超えた実績あり)。
- 目安: 見た目の微調整(色・余白・文言など)は、ユーザーの確認が一通り取れてから1つのコミット・pushにまとめる。「濃くして」「もう少し」のような連続する小さな指示のやり取り中は、都度pushせずローカル確認(dev server + スクリーンショット)で完結させ、最終形が決まってからpushする。
- mainへの反映は従来通りdevelopでの確認が取れてから、かつユーザーへの事前確認必須。

## Amplifyバックエンド環境の見分け方(データ確認時の事故防止)
このプロジェクトには**独立したバックエンド(別Cognito・別DynamoDB)が3つ**存在する: `main`(本番)、`develop`、そして個人のローカルサンドボックス(`npx ampx sandbox`等で作られる、`akimatsu-sandbox`のようなスタック名)。
- 理由: リポジトリ直下の`amplify_outputs.json`は、直近にどの環境と同期したかによって指し先が変わる。「今ローカルにあるoutputsファイルの中身」を無条件に「develop/本番のデータ」だと思い込んでAppSync/DynamoDBを調査すると、実際は個人サンドボックスの無関係なテストデータを見て誤った結論を出す事故につながる(2026-09-08に発生済み)。
- 確認方法: `amplify_outputs.json`の`data.url`からAppSyncのAPI IDを取り出し、以下でタグを見れば一発で分かる。
  ```
  aws appsync list-tags-for-resource --resource-arn arn:aws:appsync:ap-northeast-1:147560746374:apis/<APIID>
  ```
  タグの`amplify:branch-name`が`main`/`develop`ならそのブランチ、`amplify:deployment-type`が`sandbox`なら個人ローカル環境。
- 本番(main)のデータを確認したい場合は、`aws amplify get-branch --app-id d22seqgs51jtrz --branch-name main`等でmain用のAppSync API ID(現状: `5yeu5fi4jna6jivalldove63uu`)を確認し、`aws appsync list-api-keys --api-id <ID>`でAPIキーを取得してGraphQLに直接クエリする(このAPIキー取得は本番認証情報の取得にあたるため、実行前に必ずユーザーに確認する)。

## ローカル開発サーバー(npm run dev)
一度起動したローカルのdevサーバーを、確認が終わったからといって勝手に`kill`しないこと。
- 理由: ユーザー自身がブラウザで実際の画面を見ながら並行して確認・作業するために起動したままにしておきたいため。Claude側の確認作業が終わったタイミングで自動的に止めると、ユーザーが見ている画面が急に落ちてしまう。
- 対応: `npm run dev`の代わりに`scripts/dev-with-idle-timeout.sh [アイドル秒数(デフォルト600)] [ログパス]`で起動する。ページアクセス・ホットリロードが一定時間(デフォルト10分)無ければ自動でプロセスを停止する仕組みなので、手動でkillする必要がない。ビルド確認(`npm run build`)などでポートが競合する場合を除き、確認後もこのまま放置してよい。ユーザーから明示的に「止めて」と言われた時だけ`kill`する。
