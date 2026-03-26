import { PartialType } from '@nestjs/swagger';
import { CreateAgentDefinitionDto } from './create-agent-definition.dto';

export class UpdateAgentDefinitionDto extends PartialType(CreateAgentDefinitionDto) {}
