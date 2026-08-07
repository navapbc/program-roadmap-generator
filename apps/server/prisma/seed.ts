import { PrismaClient } from '@prisma/client';
import { initialOrderKeys } from '@roadmap/shared';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding placeholder data (generic names only, no real program content)...');

  const project = await prisma.project.create({
    data: {
      name: 'Sample Program',
      description: 'Seeded example project for local development.',
      startDate: new Date('2026-09-01T00:00:00Z'),
    },
  });

  const sizeCodes = ['XS', 'S', 'M', 'L', 'XL'];
  const projectLabels = await Promise.all(
    sizeCodes.map((code, orderIndex) =>
      prisma.sizeLabel.create({ data: { projectId: project.id, code, orderIndex } })
    )
  );
  const labelIdByCode = new Map(projectLabels.map((l) => [l.code, l.id]));

  // 2 Milestones x 2 Increments x 3-5 Initiatives.
  const milestoneKeys = initialOrderKeys(2);
  for (let m = 0; m < 2; m++) {
    const milestone = await prisma.milestone.create({
      data: { projectId: project.id, name: `Milestone ${m + 1}`, orderKey: milestoneKeys[m] },
    });

    const incrementKeys = initialOrderKeys(2);
    for (let inc = 0; inc < 2; inc++) {
      const increment = await prisma.increment.create({
        data: { milestoneId: milestone.id, name: `Increment ${m + 1}.${inc + 1}`, orderKey: incrementKeys[inc] },
      });

      const initiativeCount = inc === 0 ? 5 : 3;
      const initiativeKeys = initialOrderKeys(initiativeCount);
      for (let n = 0; n < initiativeCount; n++) {
        const isLast = m === 1 && inc === 1 && n === initiativeCount - 1;
        const isSecondLast = m === 1 && inc === 1 && n === initiativeCount - 2;

        if (isLast) {
          // Deliberately unsized — exercises the "missing-size" warning path.
          await prisma.initiative.create({
            data: {
              incrementId: increment.id,
              name: `Initiative ${m + 1}.${inc + 1}.${n + 1} (unsized)`,
              orderKey: initiativeKeys[n],
            },
          });
        } else if (isSecondLast) {
          // Time-estimate override — bypasses sizing entirely.
          await prisma.initiative.create({
            data: {
              incrementId: increment.id,
              name: `Initiative ${m + 1}.${inc + 1}.${n + 1} (time estimate)`,
              orderKey: initiativeKeys[n],
              timeEstimateWeeks: 3,
            },
          });
        } else {
          const code = sizeCodes[n % sizeCodes.length];
          await prisma.initiative.create({
            data: {
              incrementId: increment.id,
              name: `Initiative ${m + 1}.${inc + 1}.${n + 1}`,
              orderKey: initiativeKeys[n],
              policySizeLabelId: labelIdByCode.get(code),
              implementationSizeLabelId: labelIdByCode.get(code),
            },
          });
        }
      }
    }
  }

  // Two SizingKeys sharing the phase structure but different durations,
  // modeling "optimistic" vs "pessimistic" scenarios. Pessimistic is
  // deliberately missing the "XL" label to exercise the compatibility
  // rejection path when someone tries to select it for this project.
  // Implementation is measured in real calendar months on purpose — with
  // the project's Sep 1 start date, this schedules against actual Sep/Oct/
  // Nov/... month lengths rather than a flat average.
  async function createSizingKey(name: string, description: string, codes: string[], multiplier: number) {
    const key = await prisma.sizingKey.create({ data: { name, description } });
    await Promise.all(
      codes.map((code, orderIndex) => prisma.sizingKeyLabel.create({ data: { sizingKeyId: key.id, code, orderIndex } }))
    );

    const phaseSpecs = [
      { name: 'Discovery', unit: 'day', base: [2, 4, 6, 8, 10] },
      { name: 'Implementation', unit: 'month', base: [1, 1, 2, 2, 3] },
      { name: 'Testing', unit: 'week', base: [1, 1, 2, 2, 3] },
    ];

    for (let orderIndex = 0; orderIndex < phaseSpecs.length; orderIndex++) {
      const spec = phaseSpecs[orderIndex];
      const phase = await prisma.sizingPhase.create({
        data: { sizingKeyId: key.id, name: spec.name, unit: spec.unit, orderIndex },
      });
      await Promise.all(
        codes.map((code, i) => {
          const base = spec.base[sizeCodes.indexOf(code)] ?? spec.base[i];
          return prisma.sizingDuration.create({
            data: { sizingPhaseId: phase.id, labelCode: code, durationValue: Math.round(base * multiplier) },
          });
        })
      );
    }
    return key;
  }

  await createSizingKey('Optimistic', 'Best-case durations for the current team.', sizeCodes, 1);
  await createSizingKey(
    'Pessimistic (missing XL)',
    'Conservative durations — deliberately missing the XL label to demo the compatibility check.',
    sizeCodes.filter((c) => c !== 'XL'),
    1.5
  );

  console.log('Seed complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
