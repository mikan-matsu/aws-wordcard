# 運用ルール

## push運用(2026-10-05更新: develop環境は廃止)
develop環境は廃止した(同期コストがこの規模のトラフィックに見合わなかったため)。今後は**ローカルでbuild確認してから直接mainにpush**する。
- 手順: 修正→ローカルで`npm run build`(型エラー・ビルドエラーがないか)→必要ならdev serverで見た目確認→mainにコミット・push
- 1つの小さな修正ごとに毎回pushせず、**ある程度まとめてから**pushすること。理由: mainへのpushはAmplifyの自動ビルドをトリガーし、1回のビルドで数分〜10分程度のビルド時間が課金される。細かい修正を都度pushすると月間のAmplifyコストが積み上がる(2026年9月には1日で10回近くビルドが走り、月間コストが予算アラートの閾値を超えた実績あり)。
- 目安: 見た目の微調整(色・余白・文言など)は、ユーザーの確認が一通り取れてから1つのコミット・pushにまとめる。「濃くして」「もう少し」のような連続する小さな指示のやり取り中は、都度pushせずローカル確認(dev server + スクリーンショット)で完結させ、最終形が決まってからpushする。
- mainは本番環境なので、push前に必ずユーザーへの事前確認必須。
- 注意: ローカルの`npm run build`では検出できない本番固有の不具合もありうる(例: 2026-10-04、Amplify Hosting内部のポート番号がミドルウェアのリダイレクトURLに混入するバグはローカルでは再現しなかった)。pushして実際の挙動を確認するまでは油断しないこと。

## Amplifyバックエンド環境の見分け方(データ確認時の事故防止)
このプロジェクトには**独立したバックエンド(別Cognito・別DynamoDB)が2つ**存在する: `main`(本番)と、個人のローカルサンドボックス(`npx ampx sandbox`等で作られる、`akimatsu-sandbox`のようなスタック名)。(2026-10-05: developのバックエンドは廃止・削除済み)
- 理由: リポジトリ直下の`amplify_outputs.json`は、直近にどの環境と同期したかによって指し先が変わる。「今ローカルにあるoutputsファイルの中身」を無条件に「本番のデータ」だと思い込んでAppSync/DynamoDBを調査すると、実際は個人サンドボックスの無関係なテストデータを見て誤った結論を出す事故につながる(2026-09-08に発生済み)。
- 確認方法: `amplify_outputs.json`の`data.url`からAppSyncのAPI IDを取り出し、以下でタグを見れば一発で分かる。
  ```
  aws appsync list-tags-for-resource --resource-arn arn:aws:appsync:ap-northeast-1:147560746374:apis/<APIID>
  ```
  タグの`amplify:branch-name`が`main`ならそのブランチ、`amplify:deployment-type`が`sandbox`なら個人ローカル環境。
- 本番(main)のデータを確認したい場合は、`aws amplify get-branch --app-id d22seqgs51jtrz --branch-name main`等でmain用のAppSync API ID(現状: `5yeu5fi4jna6jivalldove63uu`)を確認し、`aws appsync list-api-keys --api-id <ID>`でAPIキーを取得してGraphQLに直接クエリする(このAPIキー取得は本番認証情報の取得にあたるため、実行前に必ずユーザーに確認する)。

## ローカル開発サーバー(npm run dev)
一度起動したローカルのdevサーバーを、確認が終わったからといって勝手に`kill`しないこと。
- 理由: ユーザー自身がブラウザで実際の画面を見ながら並行して確認・作業するために起動したままにしておきたいため。Claude側の確認作業が終わったタイミングで自動的に止めると、ユーザーが見ている画面が急に落ちてしまう。
- 対応: `npm run dev`の代わりに`scripts/dev-with-idle-timeout.sh [アイドル秒数(デフォルト600)] [ログパス]`で起動する。ページアクセス・ホットリロードが一定時間(デフォルト10分)無ければ自動でプロセスを停止する仕組みなので、手動でkillする必要がない。ビルド確認(`npm run build`)などでポートが競合する場合を除き、確認後もこのまま放置してよい。ユーザーから明示的に「止めて」と言われた時だけ`kill`する。
