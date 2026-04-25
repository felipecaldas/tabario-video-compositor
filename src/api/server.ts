import express from 'express';
import { composeRouter } from './routes/compose';
import { testRenderRouter } from './routes/testRender';

const app = express();
const PORT = parseInt(process.env.PORT ?? '9312', 10);

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'tabario-video-compositor', timestamp: new Date().toISOString() });
});

app.use('/compose', composeRouter);
app.use('/compose/test-render', testRenderRouter);

app.listen(PORT, () => {
  console.log(`tabario-video-compositor listening on port ${PORT}`);
});

export default app;
