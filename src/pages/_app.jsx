import React from "react";
import App from "next/app";
import Head from "next/head";
import { Layout } from "antd";
import { AppContextProvider } from "components/context";
import { parseCookies } from "nookies";
import Header from "components/header";

import "../styles/index.scss";

const { Footer, Content } = Layout;
// const ptDebug = Debug("ZT.AlbumHome");

class MyApp extends App {
  state = {
    isInitial: true,
  };

  componentDidMount() {
    // add a `initial-loading` class to prevent SSR HTML from
    // creating unwanted css transitions.
    process.nextTick(() => {
      setTimeout(() => {
        this.setState(() => {
          return { isInitial: false };
        });
      }, 1000);
    });
  }

  render() {
    const { Component, pageProps, router } = this.props;
    const { isInitial } = this.state;
    // tagger context
    const ctx = {
      cookies: pageProps.cookies || parseCookies(),
      tagOptions: pageProps.tagOptions,
    };
    let { pageName } = Component;
    if (typeof pageName === "function") {
      pageName = pageName(pageProps);
    } else {
      pageName = pageName ? `Zita - ${pageName}` : "Zita";
    }
    return (
      <AppContextProvider value={ctx}>
        <Layout className={isInitial ? "initial-loading" : ""}>
          <Head>
            <title>{pageName}</title>
            <meta
              name="viewport"
              content="initial-scale=1.0, width=device-width"
            />
          </Head>
          <Header router={router} />
          <Content>
            {/* eslint-disable-next-line react/jsx-props-no-spreading */}
            <Component {...pageProps} />
          </Content>
          <Footer>
            <div className="container">&copy; Zillow Inc, 2019</div>
          </Footer>
        </Layout>
      </AppContextProvider>
    );
  }
}

export default MyApp;
