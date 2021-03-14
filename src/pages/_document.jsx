import React from "react";
import Document, { Html, Head, Main, NextScript } from "next/document";
import { parseCookies, setCookie } from "nookies";
import { ZT_UID, PERSISTENT_COOKIE } from "lib/client";
import uidSafe from "uid-safe";

class MyDocument extends Document {
  static async getInitialProps(ctx) {
    const initialProps = await Document.getInitialProps(ctx);
    const cookies = parseCookies(ctx);
    // if uid cookie not set, set it
    if (!cookies[ZT_UID]) {
      const uid = await uidSafe(12);
      setCookie(ctx, ZT_UID, uid, PERSISTENT_COOKIE);
    }
    return { ...initialProps };
  }

  render() {
    return (
      <Html lang="id">
        <Head>
          <meta charSet="utf-8" />
          <meta
            name="viewport"
            content="initial-scale=1.0, width=device-width"
          />
          <link rel="icon" type="image/x-icon" href="/static/favicon.ico" />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
