import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { AppException } from '../src/common/errors/app.exception';
import type { FieldErrorDto } from '../src/common/errors/dto/field-error.dto';
import {
  createValidationPipe,
  toClientMessage,
} from '../src/common/validation/validation-pipe.factory';

/**
 * Every `fieldErrors[].message` reaches the screen verbatim under its input, and the UI is
 * Vietnamese. class-validator's defaults are English, so the pipe that packs `fieldErrors`
 * (the one place, AD-5) must replace them. These cases run the REAL pipe and decorators, so a
 * class-validator upgrade that rewords its defaults turns them red.
 */
class NestedDto {
  @IsString()
  label!: string;
}

/** One property per built-in constraint the backend's DTOs use, each one failing. */
class EveryConstraintDto {
  @IsNotEmpty() notEmpty!: string;
  @IsString() str!: string;
  @MaxLength(20) maxLen!: string;
  @MinLength(8) minLen!: string;
  @Matches(/^\d+$/) pattern!: string;
  @IsEmail() email!: string;
  @IsInt() int!: number;
  @IsNumber() num!: number;
  @Min(1) atLeast!: number;
  @Max(100) atMost!: number;
  @IsBoolean() flag!: boolean;
  @IsIn(['a', 'b']) oneOf!: string;
  @IsUUID('4') id!: string;
  @IsISO8601() at!: string;
  @IsArray() list!: string[];
  @ArrayNotEmpty() nonEmpty!: string[];
  @ArrayMinSize(2) minItems!: string[];
  @ArrayMaxSize(1) maxItems!: string[];
  @IsObject() obj!: object;
  @IsUUID('4', { each: true }) ids!: string[];
  @ValidateNested() @Type(() => NestedDto) nested!: NestedDto;
  @IsPositive() positive!: number;
  @MaxLength(5, { message: 'Ghi chú tối đa 5 ký tự.' }) custom!: string;
}

const INVALID: Record<keyof EveryConstraintDto, unknown> = {
  notEmpty: '',
  str: 7,
  maxLen: 'x'.repeat(21),
  minLen: 'short',
  pattern: 'abc',
  email: 'not-an-email',
  int: 1.5,
  num: 'NaN',
  atLeast: 0,
  atMost: 101,
  flag: 'yes',
  oneOf: 'c',
  id: 'nope',
  at: 'yesterday',
  list: 'x',
  nonEmpty: [],
  minItems: ['x'],
  maxItems: ['x', 'y'],
  obj: 'x',
  ids: ['nope'],
  nested: { label: 3 },
  positive: -1,
  custom: 'x'.repeat(6),
};

async function fieldErrorsOf(body: unknown): Promise<FieldErrorDto[]> {
  try {
    await createValidationPipe().transform(body, {
      type: 'body',
      metatype: EveryConstraintDto,
    });
  } catch (error) {
    if (error instanceof AppException) return error.fieldErrors ?? [];
    throw error;
  }
  throw new Error('the pipe accepted an invalid body');
}

function messageOf(
  errors: FieldErrorDto[],
  field: string,
  code: string,
): string | undefined {
  return errors.find((e) => e.field === field && e.code === code)?.message;
}

describe('ValidationPipe fieldErrors messages are Vietnamese', () => {
  let errors: FieldErrorDto[];

  beforeAll(async () => {
    errors = await fieldErrorsOf(INVALID);
  });

  it('covers every property (the pipe was not blind to any case)', () => {
    const fields = new Set(errors.map((e) => e.field));
    for (const key of Object.keys(INVALID)) {
      if (key === 'nested') continue; // reported on its child path
      expect(fields).toContain(key);
    }
    expect(fields).toContain('nested.label');
  });

  it.each([
    ['notEmpty', 'isNotEmpty', 'Không được để trống.'],
    ['str', 'isString', 'Phải là chuỗi ký tự.'],
    ['maxLen', 'maxLength', 'Tối đa 20 ký tự.'],
    ['minLen', 'minLength', 'Tối thiểu 8 ký tự.'],
    ['pattern', 'matches', 'Sai định dạng.'],
    ['email', 'isEmail', 'Email không hợp lệ.'],
    ['int', 'isInt', 'Phải là số nguyên.'],
    ['num', 'isNumber', 'Phải là số.'],
    ['atLeast', 'min', 'Không được nhỏ hơn 1.'],
    ['atMost', 'max', 'Không được lớn hơn 100.'],
    ['flag', 'isBoolean', 'Phải là đúng hoặc sai.'],
    ['oneOf', 'isIn', 'Giá trị không nằm trong danh sách cho phép.'],
    ['id', 'isUuid', 'Mã định danh không hợp lệ.'],
    ['at', 'isIso8601', 'Ngày giờ không hợp lệ.'],
    ['list', 'isArray', 'Phải là danh sách.'],
    ['nonEmpty', 'arrayNotEmpty', 'Danh sách không được rỗng.'],
    ['minItems', 'arrayMinSize', 'Cần ít nhất 2 phần tử.'],
    ['maxItems', 'arrayMaxSize', 'Tối đa 1 phần tử.'],
    ['obj', 'isObject', 'Phải là một đối tượng.'],
    ['ids', 'isUuid', 'Mã định danh không hợp lệ.'],
    ['nested.label', 'isString', 'Phải là chuỗi ký tự.'],
  ])('%s (%s) ⇒ %s', (field, code, expected) => {
    expect(messageOf(errors, field, code)).toBe(expected);
  });

  it('a constraint without its own text still answers in Vietnamese, not English', () => {
    expect(messageOf(errors, 'positive', 'isPositive')).toBe(
      'Giá trị không hợp lệ.',
    );
  });

  it('keeps a message the DTO wrote itself', () => {
    expect(messageOf(errors, 'custom', 'maxLength')).toBe(
      'Ghi chú tối đa 5 ký tự.',
    );
  });

  it('no message carries class-validator English or the property name', () => {
    expect(errors.length).toBeGreaterThanOrEqual(Object.keys(INVALID).length);
    for (const e of errors) {
      expect(e.message).not.toMatch(
        /\b(must|should|each value|nested property)\b/,
      );
      expect(e.message).not.toContain(e.field.split('.').pop()!);
    }
  });

  it('toClientMessage leaves Vietnamese text untouched even for a mapped code', () => {
    expect(toClientMessage('maxLength', 'Tối đa 500 ký tự.', 'address')).toBe(
      'Tối đa 500 ký tự.',
    );
  });
});
