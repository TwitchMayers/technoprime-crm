import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    CacheModule.register({
      ttl: 300, // 5 минут
      max: 100, // Максимум 100 записей в кеше
    }),
  ],
  exports: [CacheModule],
})
export class AppCacheModule {}
