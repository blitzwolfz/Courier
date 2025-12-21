use http::uri::PathAndQuery;
use prost::bytes::Buf;
use prost::Message;
use prost_reflect::{DynamicMessage, MethodDescriptor};
use tonic::client::Grpc;
use tonic::codec::{Codec, DecodeBuf, Decoder, EncodeBuf, Encoder};
use tonic::transport::Channel;
use tonic::{Request, Status};

use crate::error::AppError;

/// A codec that encodes/decodes DynamicMessage using prost
#[derive(Debug, Clone)]
pub struct DynamicCodec {
    response_descriptor: prost_reflect::MessageDescriptor,
}

impl DynamicCodec {
    pub fn new(response_descriptor: prost_reflect::MessageDescriptor) -> Self {
        Self {
            response_descriptor,
        }
    }
}

#[derive(Debug, Clone)]
pub struct DynamicEncoder;

impl Encoder for DynamicEncoder {
    type Item = DynamicMessage;
    type Error = Status;

    fn encode(&mut self, item: Self::Item, buf: &mut EncodeBuf<'_>) -> Result<(), Self::Error> {
        item.encode(buf)
            .map_err(|e| Status::internal(format!("Encode error: {}", e)))
    }
}

#[derive(Debug, Clone)]
pub struct DynamicDecoder {
    descriptor: prost_reflect::MessageDescriptor,
}

impl Decoder for DynamicDecoder {
    type Item = DynamicMessage;
    type Error = Status;

    fn decode(&mut self, buf: &mut DecodeBuf<'_>) -> Result<Option<Self::Item>, Self::Error> {
        let bytes = buf.copy_to_bytes(buf.remaining());
        if bytes.is_empty() {
            return Ok(None);
        }
        let message = DynamicMessage::decode(self.descriptor.clone(), bytes)
            .map_err(|e| Status::internal(format!("Decode error: {}", e)))?;
        Ok(Some(message))
    }
}

impl Codec for DynamicCodec {
    type Encode = DynamicMessage;
    type Decode = DynamicMessage;
    type Encoder = DynamicEncoder;
    type Decoder = DynamicDecoder;

    fn encoder(&mut self) -> Self::Encoder {
        DynamicEncoder
    }

    fn decoder(&mut self) -> Self::Decoder {
        DynamicDecoder {
            descriptor: self.response_descriptor.clone(),
        }
    }
}

/// Build the gRPC path from service and method names
/// Format: /package.ServiceName/MethodName
fn build_path(service_full_name: &str, method_name: &str) -> Result<PathAndQuery, AppError> {
    let path = format!("/{}/{}", service_full_name, method_name);
    path.parse::<PathAndQuery>()
        .map_err(|e| AppError::Internal(format!("Invalid gRPC path: {}", e)))
}

/// Make a unary gRPC call
pub async fn grpc_unary(
    url: &str,
    method: &MethodDescriptor,
    request_message: DynamicMessage,
    metadata: Vec<(String, String)>,
) -> Result<DynamicMessage, AppError> {
    let channel = Channel::from_shared(url.to_string())
        .map_err(|e| AppError::Internal(format!("Invalid URL: {}", e)))?
        .connect()
        .await
        .map_err(|e| AppError::Internal(format!("Connection failed: {}", e)))?;

    let mut grpc_client = Grpc::new(channel);
    grpc_client.ready().await
        .map_err(|e| AppError::Internal(format!("Service not ready: {}", e)))?;

    let path = build_path(
        method.parent_service().full_name(),
        method.name(),
    )?;

    let mut request = Request::new(request_message);

    // Add metadata
    for (key, value) in &metadata {
        if let (Ok(k), Ok(v)) = (
            key.parse::<tonic::metadata::MetadataKey<tonic::metadata::Ascii>>(),
            value.parse::<tonic::metadata::MetadataValue<tonic::metadata::Ascii>>(),
        ) {
            request.metadata_mut().insert(k, v);
        }
    }

    let codec = DynamicCodec::new(method.output());

    let response = grpc_client
        .unary(request, path, codec)
        .await
        .map_err(|e| AppError::Internal(format!("gRPC call failed: {}", e)))?;

    Ok(response.into_inner())
}

/// Make a server-streaming gRPC call, returns all messages collected
pub async fn grpc_server_stream(
    url: &str,
    method: &MethodDescriptor,
    request_message: DynamicMessage,
    metadata: Vec<(String, String)>,
) -> Result<Vec<DynamicMessage>, AppError> {
    let channel = Channel::from_shared(url.to_string())
        .map_err(|e| AppError::Internal(format!("Invalid URL: {}", e)))?
        .connect()
        .await
        .map_err(|e| AppError::Internal(format!("Connection failed: {}", e)))?;

    let mut grpc_client = Grpc::new(channel);
    grpc_client.ready().await
        .map_err(|e| AppError::Internal(format!("Service not ready: {}", e)))?;

    let path = build_path(
        method.parent_service().full_name(),
        method.name(),
    )?;

    let mut request = Request::new(request_message);

    for (key, value) in &metadata {
        if let (Ok(k), Ok(v)) = (
            key.parse::<tonic::metadata::MetadataKey<tonic::metadata::Ascii>>(),
            value.parse::<tonic::metadata::MetadataValue<tonic::metadata::Ascii>>(),
        ) {
            request.metadata_mut().insert(k, v);
        }
    }

    let codec = DynamicCodec::new(method.output());

    let response = grpc_client
        .server_streaming(request, path, codec)
        .await
        .map_err(|e| AppError::Internal(format!("gRPC stream failed: {}", e)))?;

    let mut stream = response.into_inner();
    let mut messages = Vec::new();

    while let Some(msg) = stream.message().await
        .map_err(|e| AppError::Internal(format!("Stream error: {}", e)))?
    {
        messages.push(msg);
    }

    Ok(messages)
}
