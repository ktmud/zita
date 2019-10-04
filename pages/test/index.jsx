import React from "react";
// import Link from "next/link";
// import { List, Card } from "antd";
// import { fetchgql } from "lib/client";

// function SelectTestAlbum({ albums }) {
//   return (
//     <div className="preds container">
//       <h1>Pick an Album</h1>
//       <List
//         grid={{ gutter: 16, column: 4 }}
//         dataSource={albums}
//         renderItem={item => (
//           <List.Item>
//             <Link href={`/test/${item.id}`}>
//               <a href={`/test/${item.id}`}>
//                 <Card title={item.title}>
//                   {item.taggedPhotos}/{item.totalPhotos} tagged
//                 </Card>
//               </a>
//             </Link>
//           </List.Item>
//         )}
//       />
//     </div>
//   );
// }

// SelectTestAlbum.getInitialProps = async ctx => {
//   const data = await fetchgql(
//     `{
//       tagOptions
//       # Take all albums
//       albums(limit: -1) {
//         id
//         title
//         taggedPhotos
//         totalPhotos
//       }
//     }`,
//     null,
//     { ctx }
//   );
//   return data;
// };

import AlbumHome from "pages/album/index";

class TestAlbumHome extends AlbumHome {
  static pathname = "/test";
}

export default TestAlbumHome;
