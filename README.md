# AWS WordCard

AWSクラウド用語をカード形式で学習できる単語帳アプリ(Next.js + AWS Amplify Gen2)。

- 本番: https://wordcard.link
- 構成: Amplify Hosting(SSR) + Cognito + AppSync + DynamoDB
- デプロイ: `main` ブランチへのpushでAmplify Hostingが自動ビルド・デプロイ

## Getting Started

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) で確認できる。`app/page.tsx` を編集すると自動リロードされる。

フォントは [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) で [Geist](https://vercel.com/font) を最適化配信している。
