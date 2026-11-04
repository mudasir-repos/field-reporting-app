import type { RequestHandler } from 'express';

const failureSimulationMiddleware: RequestHandler = (req, res, next) => {
  const failureType = req.get('x-simulate-failure')?.toLowerCase();

  switch (failureType) {
    case 'latency': {
      console.log('Simulating 10-second latency.');

      setTimeout(() => {
        next();
      }, 10_000);

      return;
    }

    case 'server-error': {
      console.log('Simulating HTTP 503.');

      return res.status(503).json({
        message: 'Simulated service unavailable.',
      });
    }

    case 'connection-drop': {
      console.log('Simulating connection drop.');

      req.socket.destroy();
      return;
    }

    case 'hang': {
      console.log('Simulating hanging request.');

      // Intentionally do not send a response or call next().
      return;
    }

    case 'lost-response': {
      if (req.method === 'POST') {
        console.log('Simulating lost response.');

        const originalJson = res.json.bind(res);

        res.json = ((...args: Parameters<typeof res.json>) => {
          // Only drop the successful first-creation response.
          // The report has already been committed to the database.
          if (res.statusCode === 201) {
            res.socket?.destroy();
            return res;
          }

          return originalJson(...args);
        }) as typeof res.json;
      }

      return next();
    }

    default:
      return next();
  }
};

export default failureSimulationMiddleware;
