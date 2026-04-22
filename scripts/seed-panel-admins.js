/**
 * Mongo-ში ადმინ პანელის იუზერები (username + bcrypt პაროლი).
 * გაშვება: node scripts/seed-panel-admins.js   (marte-backend root, .env იტვირთება)
 *
 * ბექენდზე Railway: დააყენე PANEL_ADMIN_JWT_SECRET (მინ. 24 სიმბოლო) — JWT ხელმოწერისთვის.
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { loadMarteEnv, resolveMongo } = require('./mongodb-uri');

const USERS = [
  { username: 'giga', displayName: 'გიგა', password: 'giga123!' },
  { username: 'nabakha', displayName: 'ნაბახა', password: 'nabakha123!' },
  { username: 'nikaber', displayName: 'ნიკაბერო', password: 'nikaber123!' },
  { username: 'giorgi', displayName: 'გიორგი', password: 'giorgi123!' },
];

const panelAdminUserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    displayName: { type: String },
    active: { type: Boolean, default: true },
  },
  { collection: 'panel_admin_users', timestamps: true },
);

async function main() {
  loadMarteEnv();
  const { uri } = resolveMongo();
  await mongoose.connect(uri);
  if (mongoose.models.PanelAdminUser) {
    delete mongoose.models.PanelAdminUser;
  }
  const Model = mongoose.model('PanelAdminUser', panelAdminUserSchema);

  for (const row of USERS) {
    const passwordHash = await bcrypt.hash(row.password, 10);
    await Model.findOneAndUpdate(
      { username: row.username },
      {
        $set: {
          username: row.username,
          passwordHash,
          displayName: row.displayName,
          active: true,
        },
      },
      { upsert: true },
    );
    console.log('OK:', row.username);
  }

  await mongoose.disconnect();
  console.log('დასრულდა. პროდაქშენზე შეცვალე პაროლები Mongo-ში ან ხელახლა გაუშვი სკრიპტი ახალი პაროლებით.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
