import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UserTokensService } from './user-tokens.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UserTokensService],
  exports: [UsersService, UserTokensService],
})
export class UsersModule {}
