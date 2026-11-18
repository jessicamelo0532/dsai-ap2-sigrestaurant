import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { describeWindow, parseWindows } from '../menu-availability/availability-rules';
import { SetAvailabilityDto } from '../menu-availability/menu-availability.dto';
import { loadOpeningHours } from './opening-store';

// Horário de funcionamento (SPEC/2026-11-17-horario-de-funcionamento.md, RF-01).
@Injectable()
export class OpeningHoursService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    const windows = await loadOpeningHours(this.prisma);
    return { configured: windows.length > 0, windows: windows.map(describeWindow) };
  }

  // RNF-02: troca todas as janelas numa transação; RN-01 pelas regras do cardápio por horário (RNF-01).
  async replace(dto: SetAvailabilityDto) {
    const windows = parseWindows(dto.windows);
    await this.prisma.$transaction(async (tx) => {
      await tx.openingHour.deleteMany();
      if (windows.length) await tx.openingHour.createMany({ data: windows });
    });
    return this.get();
  }
}
