export const orderInclude = {
  items: { orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }], include: { addons: { orderBy: { id: 'asc' as const } } } },
};
