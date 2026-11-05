// s3Ipc —— S3 代理 IPC（从 pluginIpc.cjs 拆出，通道与行为完全一致）
// 自包含：客户端缓存（LRU 上限 5）+ 端点规范化 + 全部 s3:* handler

const { ipcMain } = require('electron');
const { getMimeType } = require('../services/fileTypeUtils.cjs');

const S3_CLIENTS = new Map();
const MAX_S3_CLIENTS = 5;

function normalizeEndpoint(endpoint) {
  if (!endpoint) return '';
  if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
    return `https://${endpoint}`;
  }
  return endpoint;
}

function getS3Client(config) {
  const key = `${config.endpoint}-${config.accessKeyId}`;
  if (S3_CLIENTS.has(key)) {
    return S3_CLIENTS.get(key);
  }

  if (S3_CLIENTS.size >= MAX_S3_CLIENTS) {
    const firstKey = S3_CLIENTS.keys().next().value;
    if (firstKey) S3_CLIENTS.delete(firstKey);
  }

  const { S3Client } = require('@aws-sdk/client-s3');
  const normalizedEndpoint = normalizeEndpoint(config.endpoint);
  const region = config.region || 'us-east-1';

  const client = new S3Client({
    region: region,
    endpoint: normalizedEndpoint || undefined,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: true,
    tls: normalizedEndpoint?.includes('localhost') && normalizedEndpoint?.startsWith('http:') ? false : true,
    signingRegion: region,
    signingName: 's3',
  });

  S3_CLIENTS.set(key, { client, config });
  return { client, config };
}

function registerS3Ipc() {
  ipcMain.handle('s3:listBuckets', async (_event, config) => {
    try {
      console.log('[S3 Proxy] listBuckets called with config:', {
        endpoint: config.endpoint,
        region: config.region,
        accessKeyId: config.accessKeyId?.substring?.(0, 8) + '...',
        bucketName: config.bucketName
      });

      const { client } = getS3Client(config);
      const { ListBucketsCommand } = require('@aws-sdk/client-s3');
      const command = new ListBucketsCommand({});
      const response = await client.send(command);

      console.log('[S3 Proxy] listBuckets success:', response.Buckets?.length || 0, 'buckets');
      return {
        success: true,
        data: (response.Buckets || []).map(b => ({
          name: b.Name || 'Unknown',
          creationDate: b.CreationDate
        }))
      };
    } catch (error) {
      console.error('[S3 Proxy] listBuckets error:', error);
      return {
        success: false,
        error: error.message,
        name: error.name,
        code: error.code || error.$metadata?.httpStatusCode,
        details: JSON.stringify(error, null, 2)
      };
    }
  });

  ipcMain.handle('s3:listFiles', async (_event, { config, prefix }) => {
    try {
      console.log('[S3 Proxy] listFiles called:', { bucket: config.bucketName, prefix });
      const { client } = getS3Client(config);
      const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
      let isTruncated = true;
      let continuationToken;
      const allFiles = [];

      while (isTruncated) {
        const command = new ListObjectsV2Command({
          Bucket: config.bucketName,
          Prefix: prefix || '',
          Delimiter: '/',
          ContinuationToken: continuationToken,
        });

        const response = await client.send(command);

        if (response.CommonPrefixes) {
          response.CommonPrefixes.forEach((p) => {
            if (p.Prefix) {
              const exists = allFiles.some(f => f.key === p.Prefix);
              if (!exists) {
                allFiles.push({
                  key: p.Prefix,
                  name: p.Prefix.replace(prefix || '', '').replace('/', ''),
                  size: 0,
                  lastModified: new Date(),
                  isFolder: true,
                });
              }
            }
          });
        }

        if (response.Contents) {
          response.Contents.forEach((c) => {
            if (c.Key && c.Key !== prefix) {
              allFiles.push({
                key: c.Key,
                name: c.Key.replace(prefix || '', ''),
                size: c.Size || 0,
                lastModified: c.LastModified || new Date(),
                isFolder: false,
                mimeType: getMimeType(c.Key),
              });
            }
          });
        }

        isTruncated = response.IsTruncated || false;
        continuationToken = response.NextContinuationToken;
      }

      console.log('[S3 Proxy] listFiles success:', allFiles.length, 'files');
      return {
        success: true,
        data: allFiles.sort((a, b) => {
          if (a.isFolder === b.isFolder) {
            return a.name.localeCompare(b.name);
          }
          return a.isFolder ? -1 : 1;
        })
      };
    } catch (error) {
      console.error('[S3 Proxy] listFiles error:', error);
      return {
        success: false,
        error: error.message,
        name: error.name,
        code: error.code || error.$metadata?.httpStatusCode,
        details: JSON.stringify(error, null, 2)
      };
    }
  });

  ipcMain.handle('s3:getObject', async (_event, { config, key }) => {
    try {
      console.log('[S3 Proxy] getObject called:', { bucket: config.bucketName, key });
      const { client } = getS3Client(config);
      const { GetObjectCommand } = require('@aws-sdk/client-s3');
      const command = new GetObjectCommand({
        Bucket: config.bucketName,
        Key: key,
      });
      const response = await client.send(command);
      if (response.Body) {
        const byteArray = await response.Body.transformToByteArray();
        console.log('[S3 Proxy] getObject success:', byteArray.length, 'bytes');
        return {
          success: true,
          data: byteArray.buffer,
          contentType: response.ContentType || 'application/octet-stream'
        };
      }
      return { success: false, error: 'No body in response', name: 'Error' };
    } catch (error) {
      console.error('[S3 Proxy] getObject error:', error);
      return {
        success: false,
        error: error.message,
        name: error.name,
        code: error.code || error.$metadata?.httpStatusCode,
        details: JSON.stringify(error, null, 2)
      };
    }
  });

  ipcMain.handle('s3:putObject', async (_event, { config, key, body, contentType }) => {
    try {
      console.log('[S3 Proxy] putObject called:', { bucket: config.bucketName, key, contentType });
      const { client } = getS3Client(config);
      const { PutObjectCommand } = require('@aws-sdk/client-s3');
      const command = new PutObjectCommand({
        Bucket: config.bucketName,
        Key: key,
        Body: typeof body === 'string' ? body : Buffer.from(body),
        ContentType: contentType || 'text/plain',
      });
      await client.send(command);
      console.log('[S3 Proxy] putObject success');
      return { success: true };
    } catch (error) {
      console.error('[S3 Proxy] putObject error:', error);
      return {
        success: false,
        error: error.message,
        name: error.name,
        code: error.code || error.$metadata?.httpStatusCode,
        details: JSON.stringify(error, null, 2)
      };
    }
  });

  ipcMain.handle('s3:deleteObject', async (_event, { config, key }) => {
    try {
      console.log('[S3 Proxy] deleteObject called:', { bucket: config.bucketName, key });
      const { client } = getS3Client(config);
      const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
      const command = new DeleteObjectCommand({
        Bucket: config.bucketName,
        Key: key,
      });
      await client.send(command);
      console.log('[S3 Proxy] deleteObject success');
      return { success: true };
    } catch (error) {
      console.error('[S3 Proxy] deleteObject error:', error);
      return {
        success: false,
        error: error.message,
        name: error.name,
        code: error.code || error.$metadata?.httpStatusCode,
        details: JSON.stringify(error, null, 2)
      };
    }
  });

  ipcMain.handle('s3:deleteObjects', async (_event, { config, keys }) => {
    try {
      console.log('[S3 Proxy] deleteObjects called:', { bucket: config.bucketName, count: keys.length });
      const { client } = getS3Client(config);
      const { DeleteObjectsCommand } = require('@aws-sdk/client-s3');
      const command = new DeleteObjectsCommand({
        Bucket: config.bucketName,
        Delete: {
          Objects: keys.map(k => ({ Key: k })),
          Quiet: true
        }
      });
      await client.send(command);
      console.log('[S3 Proxy] deleteObjects success');
      return { success: true };
    } catch (error) {
      console.error('[S3 Proxy] deleteObjects error:', error);
      return {
        success: false,
        error: error.message,
        name: error.name,
        code: error.code || error.$metadata?.httpStatusCode,
        details: JSON.stringify(error, null, 2)
      };
    }
  });

  ipcMain.handle('s3:copyObject', async (_event, { config, sourceKey, destKey }) => {
    try {
      console.log('[S3 Proxy] copyObject called:', { bucket: config.bucketName, sourceKey, destKey });
      const { client } = getS3Client(config);
      const { CopyObjectCommand } = require('@aws-sdk/client-s3');
      const command = new CopyObjectCommand({
        Bucket: config.bucketName,
        Key: destKey,
        CopySource: `${config.bucketName}/${encodeURIComponent(sourceKey)}`,
      });
      await client.send(command);
      console.log('[S3 Proxy] copyObject success');
      return { success: true };
    } catch (error) {
      console.error('[S3 Proxy] copyObject error:', error);
      return {
        success: false,
        error: error.message,
        name: error.name,
        code: error.code || error.$metadata?.httpStatusCode,
        details: JSON.stringify(error, null, 2)
      };
    }
  });

  ipcMain.handle('s3:getPresignedUrl', async (_event, { config, key, options }) => {
    try {
      const { client } = getS3Client(config);
      const { GetObjectCommand } = require('@aws-sdk/client-s3');
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

      const commandInput = {
        Bucket: config.bucketName,
        Key: key,
      };

      if (options?.download) {
        const filename = key.split('/').pop() || 'file';
        commandInput.ResponseContentDisposition = `attachment; filename="${filename}"`;
      }

      const command = new GetObjectCommand(commandInput);
      const url = await getSignedUrl(client, command, { expiresIn: options?.expiresIn || 3600 });
      return { success: true, data: url };
    } catch (error) {
      console.error('[S3 Proxy] getPresignedUrl error:', error);
      return { success: false, error: error.message, name: error.name, code: error.code || error.$metadata?.httpStatusCode, details: JSON.stringify(error, null, 2) };
    }
  });

  ipcMain.handle('s3:uploadFile', async (_event, { config, key, fileBuffer, contentType }) => {
    try {
      console.log('[S3 Proxy] uploadFile called:', { bucket: config.bucketName, key, contentType });
      const { client } = getS3Client(config);
      const { PutObjectCommand } = require('@aws-sdk/client-s3');
      const command = new PutObjectCommand({
        Bucket: config.bucketName,
        Key: key,
        Body: Buffer.from(fileBuffer),
        ContentType: contentType || 'application/octet-stream',
      });
      await client.send(command);
      console.log('[S3 Proxy] uploadFile success');
      return { success: true };
    } catch (error) {
      console.error('[S3 Proxy] uploadFile error:', error);
      return { success: false, error: error.message, name: error.name, code: error.code || error.$metadata?.httpStatusCode, details: JSON.stringify(error, null, 2) };
    }
  });

  ipcMain.handle('s3:listAllObjects', async (_event, { config, prefix }) => {
    try {
      console.log('[S3 Proxy] listAllObjects called:', { bucket: config.bucketName, prefix });
      const { client } = getS3Client(config);
      const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
      let isTruncated = true;
      let continuationToken;
      const objects = [];

      while (isTruncated) {
        const command = new ListObjectsV2Command({
          Bucket: config.bucketName,
          Prefix: prefix || '',
          ContinuationToken: continuationToken,
        });

        const response = await client.send(command);

        if (response.Contents) {
          response.Contents.forEach(c => {
            if (c.Key) objects.push({ Key: c.Key, Size: c.Size || 0 });
          });
        }

        isTruncated = response.IsTruncated || false;
        continuationToken = response.NextContinuationToken;
      }

      console.log('[S3 Proxy] listAllObjects success:', objects.length, 'objects');
      return { success: true, data: objects };
    } catch (error) {
      console.error('[S3 Proxy] listAllObjects error:', error);
      return { success: false, error: error.message, name: error.name, code: error.code || error.$metadata?.httpStatusCode, details: JSON.stringify(error, null, 2) };
    }
  });

  ipcMain.handle('s3:createBucket', async (_event, { config, bucketName }) => {
    try {
      console.log('[S3 Proxy] createBucket called:', { bucketName });
      const { client } = getS3Client(config);
      const { CreateBucketCommand } = require('@aws-sdk/client-s3');
      const command = new CreateBucketCommand({ Bucket: bucketName });
      await client.send(command);
      console.log('[S3 Proxy] createBucket success');
      return { success: true };
    } catch (error) {
      console.error('[S3 Proxy] createBucket error:', error);
      return { success: false, error: error.message, name: error.name, code: error.code || error.$metadata?.httpStatusCode, details: JSON.stringify(error, null, 2) };
    }
  });

  ipcMain.handle('s3:deleteBucket', async (_event, { config, bucketName }) => {
    try {
      console.log('[S3 Proxy] deleteBucket called:', { bucketName });
      const { client } = getS3Client(config);
      const { DeleteBucketCommand } = require('@aws-sdk/client-s3');
      const command = new DeleteBucketCommand({ Bucket: bucketName });
      await client.send(command);
      console.log('[S3 Proxy] deleteBucket success');
      return { success: true };
    } catch (error) {
      console.error('[S3 Proxy] deleteBucket error:', error);
      return { success: false, error: error.message, name: error.name, code: error.code || error.$metadata?.httpStatusCode, details: JSON.stringify(error, null, 2) };
    }
  });
}

module.exports = { registerS3Ipc };
