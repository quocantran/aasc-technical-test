import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { WsException } from '@nestjs/websockets';

@Injectable()
export class WsValidationPipe implements PipeTransform {
  async transform(value: any, metadata: ArgumentMetadata) {
    const { metatype } = metadata;

    // Skip validation if metatype is missing or basic types
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    // Skip if value is a Socket.IO connection instance
    if (
      value &&
      typeof value === 'object' &&
      ('handshake' in value ||
        'broadcast' in value ||
        'connected' in value ||
        'nsp' in value ||
        'adapter' in value)
    ) {
      return value;
    }

    // Skip if value is not an object payload
    if (typeof value !== 'object' || value === null) {
      return value;
    }

    const object = plainToInstance(metatype, value);
    const errors = await validate(object, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length > 0) {
      const errorMessages = errors
        .map((err) =>
          err.constraints
            ? Object.values(err.constraints).join(', ')
            : `Validation error on property ${err.property}`,
        )
        .join('; ');
      throw new WsException(`Validation failed: ${errorMessages}`);
    }

    return object;
  }

  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype) && metatype.name !== 'Socket';
  }
}
