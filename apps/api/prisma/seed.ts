import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const menu = [
    { name: 'Bruschetta da casa', category: 'Entradas', description: 'Tomate fresco, manjericão e pão tostado', price: '24.00' },
    { name: 'Risoto de cogumelos', category: 'Pratos principais', description: 'Arroz arbóreo, cogumelos e parmesão', price: '58.00' },
    { name: 'Peixe do dia', category: 'Pratos principais', description: 'Pesca fresca com legumes da estação', price: '72.00' },
    { name: 'Limonada da casa', category: 'Bebidas', description: 'Limão, hortelã e água com gás', price: '16.00' },
    { name: 'Pudim de cumaru', category: 'Sobremesas', description: 'Pudim cremoso com calda de caramelo', price: '22.00' },
  ];
  for (const item of menu) {
    const existing = await prisma.menuItem.findFirst({ where: { name: item.name } });
    if (existing) await prisma.menuItem.update({ where: { id: existing.id }, data: item });
    else await prisma.menuItem.create({ data: item });
  }
  for (const [number, capacity] of [[1, 2], [2, 2], [3, 4], [4, 4], [5, 6]] as const) {
    await prisma.diningTable.upsert({ where: { number }, update: {}, create: { number, capacity } });
  }
}

main().finally(() => prisma.$disconnect());
