import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Uma única conexão com o banco compartilhada por todos os módulos da API.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
