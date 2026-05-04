import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

const ROUTES = [
  // KORAPUT origins
  { from: "Koraput", to: "Jeypore",           km: 65,  min: 105, fare: 12000 },
  { from: "Koraput", to: "Sunabeda",          km: 42,  min: 65,  fare: 8500  },
  { from: "Koraput", to: "Boipariguda",       km: 30,  min: 50,  fare: 6500  },
  { from: "Koraput", to: "Kundra",            km: 35,  min: 55,  fare: 7000  },
  { from: "Koraput", to: "Narayanpatna",      km: 55,  min: 80,  fare: 10500 },
  { from: "Koraput", to: "Malkangiri",        km: 135, min: 195, fare: 22500 },
  { from: "Koraput", to: "Rayagada",          km: 148, min: 210, fare: 24500 },
  { from: "Koraput", to: "Jagdalpur",         km: 190, min: 255, fare: 31000 },
  { from: "Koraput", to: "Duduma Falls",      km: 52,  min: 80,  fare: 10000 },
  { from: "Koraput", to: "Gupteswar",         km: 60,  min: 95,  fare: 11500 },
  { from: "Koraput", to: "Deomali",           km: 45,  min: 70,  fare: 9000  },
  // JEYPORE origins
  { from: "Jeypore", to: "Koraput",           km: 65,  min: 105, fare: 12000 },
  { from: "Jeypore", to: "Sunabeda",          km: 28,  min: 40,  fare: 6000  },
  { from: "Jeypore", to: "Boipariguda",       km: 38,  min: 60,  fare: 7500  },
  { from: "Jeypore", to: "Kundra",            km: 45,  min: 70,  fare: 9000  },
  { from: "Jeypore", to: "Narayanpatna",      km: 72,  min: 110, fare: 13000 },
  { from: "Jeypore", to: "Malkangiri",        km: 145, min: 205, fare: 24000 },
  { from: "Jeypore", to: "Rayagada",          km: 112, min: 160, fare: 19000 },
  { from: "Jeypore", to: "Jagdalpur",         km: 160, min: 225, fare: 26000 },
  { from: "Jeypore", to: "Kolab Dam",         km: 18,  min: 28,  fare: 5000  },
  { from: "Jeypore", to: "Pottangi",          km: 65,  min: 100, fare: 12000 },
  { from: "Jeypore", to: "Sunabeda Wildlife", km: 28,  min: 40,  fare: 6000  },
];

async function main() {
  console.log("Seeding RouteConfig...");

  for (const r of ROUTES) {
    await prisma.routeConfig.upsert({
      where: { from_city_to_city: { from_city: r.from, to_city: r.to } },
      update: { distance_km: r.km, duration_min: r.min, base_fare: r.fare },
      create: {
        from_city:    r.from,
        to_city:      r.to,
        distance_km:  r.km,
        duration_min: r.min,
        base_fare:    r.fare,
        is_active:    true,
      },
    });
    console.log(`  ✓ ${r.from} → ${r.to} (${r.km}km, ₹${r.fare / 100})`);
  }

  console.log(`\nSeeded ${ROUTES.length} routes.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
