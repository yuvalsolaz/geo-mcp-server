import express from 'express';
import { Request, Response } from 'express';
import axios from 'axios';
import { Server } from 'socket.io';
import http from 'http';

// Interface definitions based on the Python service response
interface GeocodeResult {
  display_name: string;
  confidence: number[];
  boundingboxes: number[][];
  levels_polygons: number[][];
}

interface GeocodeResponse {
  results: GeocodeResult[];
  status: 'success' | 'error';
  message?: string;
}

// Configuration
const PORT = process.env.PORT || 3000;
const GEOCODING_SERVICE_URL = process.env.GEOCODING_SERVICE_URL || 'http://localhost:5008';

// Initialize Express app
const app = express();
app.use(express.json());
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Handle geocoding requests from clients
  socket.on('geocoding-request', async (data: { text: string; k?: string }) => {
    try {
      const response = await handleGeocodingRequest(data.text, data.k);
      socket.emit('geocoding-response', response);
    } catch (error) {
      console.error('Error handling geocoding request:', error);
      socket.emit('geocoding-response', {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Function to handle geocoding requests
async function handleGeocodingRequest(text: string, k?: string): Promise<GeocodeResponse> {
  try {
    const url = `${GEOCODING_SERVICE_URL}/geocoding?text=${encodeURIComponent(text)}${k ? `&k=${k}` : ''}`;
    const response = await axios.get(url);
    
    return {
      results: response.data,
      status: 'success'
    };
  } catch (error) {
    console.error('Error calling geocoding service:', error);
    throw new Error('Failed to communicate with geocoding service');
  }
}

// REST API endpoints
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

app.post('/geocode', async (req: Request, res: Response) => {
  try {
    const { text, k } = req.body;
    
    if (!text) {
      return res.status(400).json({ 
        status: 'error',
        message: 'Text query is required' 
      });
    }
    
    const response = await handleGeocodingRequest(text, k);
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

// Start the server
server.listen(PORT, () => {
  console.log(`MCP Geocoding Server running on port ${PORT}`);
  console.log(`Connected to geocoding service at ${GEOCODING_SERVICE_URL}`);
});

// Error handling for unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
