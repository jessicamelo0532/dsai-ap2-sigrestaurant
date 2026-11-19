import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateTableDto } from '../dto';
import { PrismaService } from '../prisma.service';
import { resolveZoneId } from '../zones/zone-store';
import { orderInclude } from '../orders/order-include';

@Injectable()
export class TablesService {
  constructor(private readonly prisma: PrismaService) {}

  async listTables() {
    const tables = await this.prisma.diningTable.findMany({
      orderBy: { number: 'asc' },
      include: { orders: { where: { status: 'OPEN' }, include: orderInclude, take: 1 } },
    });
    return tables.map(({ orders, ...table }) => ({ ...table, order: orders[0] ?? null }));
  }

  async createTable(dto: CreateTableDto) {
    if (await this.prisma.diningTable.findUnique({ where: { number: dto.number } })) {
      throw new BadRequestException('Já existe uma mesa com esse número.');
    }
    const { zoneId, ...table } = dto;
    return this.prisma.diningTable.create({ data: { ...table, zoneId: await resolveZoneId(this.prisma, zoneId) } });
  }

  async deleteTable(id: number) {
    const table = await this.prisma.diningTable.findUnique({ where: { id } });
    if (!table) throw new NotFoundException('Mesa não encontrada.');
    const open = await this.prisma.order.findFirst({ where: { tableId: id, status: 'OPEN' } });
    if (open) throw new BadRequestException('Feche a comanda antes de remover esta mesa.');
    // RN-09 da SPEC/2026-11-12-reservas-de-mesa.md
    const booked = await this.prisma.reservation.findFirst({
      where: { tableId: id, status: 'BOOKED', endsAt: { gt: new Date() } },
    });
    if (booked) throw new BadRequestException('Esta mesa tem reservas agendadas. Cancele ou remarque antes de remover.');
    await this.prisma.diningTable.delete({ where: { id } });
    return { success: true };
  }
}
