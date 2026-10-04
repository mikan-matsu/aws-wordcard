import { NextRequest, NextResponse } from "next/server";

// Amplify Hosting(SSR Compute構成)ではカスタムリダイレクトルール(customRules)が
// ホスト名ベースのリダイレクトに効かないため、www→apexの正規化はproxyで行う
export function proxy(request: NextRequest) {
  const hostname = request.headers.get("host") ?? "";
  if (hostname === "www.wordcard.link") {
    const url = new URL(request.url);
    url.hostname = "wordcard.link";
    return NextResponse.redirect(url, 301);
  }
  return NextResponse.next();
}
