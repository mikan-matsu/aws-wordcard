import { NextRequest, NextResponse } from "next/server";

// Amplify Hosting(SSR Compute構成)ではカスタムリダイレクトルール(customRules)が
// ホスト名ベースのリダイレクトに効かないため、www→apexの正規化はproxyで行う
export function proxy(request: NextRequest) {
  const hostname = request.headers.get("host") ?? "";
  if (hostname === "www.wordcard.link") {
    // request.urlはAmplify内部のポート(:3000等)を含むことがあるため、
    // ホスト名の変更だけでなくprotocol/portも公開用の値に明示的に揃える
    const url = new URL(request.url);
    url.protocol = "https:";
    url.hostname = "wordcard.link";
    url.port = "";
    return NextResponse.redirect(url, 301);
  }
  return NextResponse.next();
}
