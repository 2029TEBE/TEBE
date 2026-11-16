import { Module } from '@nestjs/common';
import { GaizCustomerController } from './gaiz-customer.controller';

/**
 * Authentication comes from the existing global AuthModule.
 * TenantMiddleware is already applied to every /api/* request in AppModule.
 * No service, key custody, provider credential or database grant is introduced.
 */
@Module({ controllers: [GaizCustomerController] })
export class GaizCustomerModule {}
