import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { requireCapability } from '../common/require-capability';

/** Run before Multer/FileInterceptor to reject unauthorized uploads without
 * reading, buffering, or parsing their contents. Service retains write checks. */
@Injectable()
export class ExcelImportGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    requireCapability('pmoa_manage_projects');
    requireCapability('pmoa_manage_finance');
    return true;
  }
}
