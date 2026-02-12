import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationsDto {
  @ApiProperty({ description: 'Enable email notifications for new tickets', required: false })
  @IsOptional()
  @IsBoolean()
  emailOnNewTicket?: boolean;

  @ApiProperty({ description: 'Enable email notifications for ticket status changes', required: false })
  @IsOptional()
  @IsBoolean()
  emailOnStatusChange?: boolean;

  @ApiProperty({ description: 'Enable email notifications for new comments', required: false })
  @IsOptional()
  @IsBoolean()
  emailOnComment?: boolean;

  @ApiProperty({ description: 'Enable weekly email report', required: false })
  @IsOptional()
  @IsBoolean()
  emailWeeklyReport?: boolean;
}
