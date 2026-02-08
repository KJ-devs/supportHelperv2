import { Request } from 'express';
import { UserPayload } from './user-payload.interface';
import { SdkPayload } from './sdk-payload.interface';

/**
 * Extended Express Request with user/sdk payload
 */
export interface RequestWithUser extends Request {
  user?: UserPayload;
  sdk?: SdkPayload;
}
