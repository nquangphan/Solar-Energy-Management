import { ApiProperty } from '@nestjs/swagger';
import { PERM } from '../domain/permission-registry';
import { IsArray, IsString } from 'class-validator';

/**
 * Body of `PUT /accounts/:id/permissions` — REPLACES the whole set. An empty array is valid
 * (revoke everything). Keys outside the registry pass this DTO on purpose: the service answers
 * them with a 400 whose `fieldErrors` point at `permissions`.
 */
export class UpdateAccountPermissionsRequestDto {
  @ApiProperty({
    type: [String],
    description: 'Bộ quyền MỚI, thay thế toàn bộ bộ cũ.',
    example: [PERM.catalogView, PERM.customersManage],
  })
  @IsArray()
  @IsString({ each: true })
  permissions!: string[];
}
