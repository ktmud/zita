import { nextAvailAlbum } from "lib/client";
import Router from "next/router";

class Home {
  static pathname = "/album";

  static async getInitialProps(ctx) {
    const id = await nextAvailAlbum(ctx);
    const dest = `${this.pathname}/${id}`;

    if (ctx && ctx.res) {
      ctx.res.writeHead(302, { Location: dest });
      ctx.res.end();
    } else {
      const href = `${this.pathname}/[albumId]`;
      const as = dest;
      Router.replace(href, as);
    }
    return {};
  }
}

export default Home;
