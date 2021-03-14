import React from "react";
import Link from "next/link";
import { Layout, Menu, Icon } from "antd";
import FakeProgress from "components/fakeProgress";

const { Header } = Layout;

function MyHeader({ router }) {
  const { albumId } = router.query;

  const urlItem = section => {
    if (albumId) {
      return {
        href: `/${section}/[albumId]`,
        as: `/${section}/${albumId}`
      };
    }
    return {
      as: `/${section}`,
      href: `/${section}`
    };
  };

  const menuItems = [
    {
      ...urlItem("album"),
      icon: "flag",
      text: "Label"
    },
    // {
    //   ...urlItem("train"),
    //   route: "/train",
    //   icon: "control",
    //   text: "Train"
    // },
    {
      ...urlItem("test"),
      icon: "experiment",
      text: "Test"
    }
    // {
    //   as: "/predict",
    //   href: "/predict",
    //   icon: "file-image",
    //   text: "Predict"
    // }
  ];
  const curPage = (
    menuItems.find(x => {
      if (x.as === router.asPath) return true;
      return x.href === router.pathname;
    }) || {}
  ).as;

  return (
    <>
      <Header>
        <div className="container">
          <div className="logo">
            <Link href="/">
              <a href="/">
                <span className="logo-icon">
                  <span role="img">🖼</span>
                </span>
                Zita
              </a>
            </Link>
            <span className="subtitle">Tag photo lightening fast</span>
          </div>
          <Menu theme="dark" mode="horizontal" selectedKeys={[curPage]}>
            {menuItems.map(({ icon, text, href, as }) => (
              <Menu.Item key={as}>
                <Link href={href} as={as}>
                  <a href={as}>
                    <Icon type={icon} />
                    <span>{text}</span>
                  </a>
                </Link>
              </Menu.Item>
            ))}
          </Menu>
        </div>
      </Header>
      <FakeProgress router={router} />
    </>
  );
}

export default MyHeader;
