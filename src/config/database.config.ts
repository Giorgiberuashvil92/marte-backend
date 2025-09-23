import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  uri:
    process.env.MONGODB_URI ||
    'mongodb+srv://gberuashvili92:aegzol2o3jC31sj3@cluster0.hqqyz.mongodb.net/carapp-v2?retryWrites=true&w=majority&appName=Cluster0',
}));
