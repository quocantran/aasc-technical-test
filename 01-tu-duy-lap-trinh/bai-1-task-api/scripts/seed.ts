import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';

// Task status constants
const TASK_STATUSES = ['To Do', 'In Progress', 'Done'] as const;

// Sample task titles for seeder
const SAMPLE_TITLES = [
  'Design backend system architecture',
  'Build RESTful API with NestJS',
  'Optimize MongoDB queries and indexing',
  'Setup Swagger OpenAPI documentation',
  'Write Jest unit tests for TaskService',
  'Configure Docker Compose for MongoDB',
  'Perform load testing and measure latency',
  'Integrate global validation pipes for DTOs',
  'Refactor code following Clean Code and SOLID',
  'Package application and write README documentation',
];

// Sample task descriptions
const SAMPLE_DESCRIPTIONS = [
  'Analyze requirements and organize modules following MVC architecture.',
  'Implement CRUD methods with comprehensive validation and error handling.',
  'Use connection pooling and unique index on UUID field for fast queries.',
  'Document API endpoints with request bodies and response schemas.',
  'Cover edge cases and NotFoundException handling in service tests.',
  'Initialize isolated environment using mongo:7.0 container.',
];

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/task-api';

async function seed() {
  console.log('=== DATABASE SEEDER: POPULATE 100 TASKS INTO MONGODB ===');
  console.log(`Connecting to MongoDB: ${MONGODB_URI}...`);

  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB successfully.');

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Unable to access MongoDB database instance.');
  }

  const tasksCollection = db.collection('tasks');

  // Clean existing tasks collection
  const deleteResult = await tasksCollection.deleteMany({});
  console.log(`Cleaned ${deleteResult.deletedCount} existing tasks from database.`);

  // Generate 100 sample tasks
  const tasksToInsert = [];
  const now = Date.now();

  for (let i = 1; i <= 100; i++) {
    const titleTemplate = SAMPLE_TITLES[(i - 1) % SAMPLE_TITLES.length];
    const descTemplate = SAMPLE_DESCRIPTIONS[(i - 1) % SAMPLE_DESCRIPTIONS.length];
    const status = TASK_STATUSES[(i - 1) % TASK_STATUSES.length];

    tasksToInsert.push({
      id: randomUUID(),
      title: `[Task #${i.toString().padStart(3, '0')}] ${titleTemplate}`,
      description: `${descTemplate} (Sample record #${i})`,
      status,
      createdAt: new Date(now - (100 - i) * 60000),
    });
  }

  await tasksCollection.insertMany(tasksToInsert);
  console.log(`Inserted ${tasksToInsert.length} sample tasks successfully.`);

  // Create unique index on id field
  await tasksCollection.createIndex({ id: 1 }, { unique: true });
  console.log('Created unique index on "id" field.');

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB. Seeding completed.');
  console.log('========================================================');
}

seed().catch((err) => {
  console.error('Error running seeder:', err);
  process.exit(1);
});
