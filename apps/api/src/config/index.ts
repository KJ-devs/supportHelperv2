import appConfig from './app.config';
import databaseConfig from './database.config';
import jwtConfig from './jwt.config';
import s3Config from './s3.config';
import openaiConfig from './openai.config';
import meilisearchConfig from './meilisearch.config';
import githubConfig from './github.config';
import monitoringConfig from './monitoring.config';

export default [
  appConfig,
  databaseConfig,
  jwtConfig,
  s3Config,
  openaiConfig,
  meilisearchConfig,
  githubConfig,
  monitoringConfig,
];

export * from './env.validation';
