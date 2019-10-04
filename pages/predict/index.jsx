/**
 * Predict user-uploaded pictures
 */
import React from "react";
import { Upload, Icon, PageHeader, Row, Col } from "antd";

function getBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

function PredictPage() {
  const onUploadStatusChange = info => {
    console.log(info);
  };

  return (
    <div className="preds container">
      <PageHeader backIcon={false} title="Predict Image Labels" />
      <div className="main">
        <Row gutter={24}>
          <Col span={16}>
            <Upload.Dragger
              name="files"
              action="/api/predict"
              showUploadList={false}
              onChange={onUploadStatusChange}
            >
              <p className="ant-upload-drag-icon">
                <Icon type="inbox" />
              </p>
              <p className="ant-upload-text">
                Click or drag files to this area to see predictions
              </p>
              <p className="ant-upload-hint">
                Support for a single or bulk upload.
              </p>
            </Upload.Dragger>
          </Col>
          <Col span={8}>
            <h3>{/* Predictions */}</h3>
          </Col>
        </Row>
      </div>
    </div>
  );
}

PredictPage.pageName = "Predit Any Image";

export default PredictPage;
