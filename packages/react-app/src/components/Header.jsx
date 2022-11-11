import { PageHeader } from "antd";
import React from "react";
import { InfoCircleOutlined } from '@ant-design/icons';

// displays a page header

export default function Header() {
  return (
    <div id="header-wrapper">
        <div>
          <PageHeader
            title="Bolita"
            subTitle={<a href="https://github.com/0xWildhare/ballita.git" target="_blank" rel="noopener noreferrer">forkable project</a>}
            style={{ cursor: "pointer" }}
              extra=<a href="#">{<InfoCircleOutlined />}</a>
          />
        </div>
    </div>
  );
}
