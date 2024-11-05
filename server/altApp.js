const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const querystring = require('querystring');

dotenv.config();

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

const client_id = process.env.SPOTIFY_CLIENT_ID;
const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
const redirect_uri = process.env.REDIRECT_URI;

let access_token = "";

// 1. Route for Spotify login - Redirects to Spotify's authorization page
app.get('/login', (req, res) => {
  const scopes = 'user-top-read playlist-modify-private';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scopes,
      redirect_uri: redirect_uri
    }));
});

// 2. Spotify Callback - Handles authorization code exchange for an access token
app.get('/callback', async (req, res) => {
  const code = req.query.code || null; // Get authorization code from query params

  try {
    // Exchange authorization code for access token
    const response = await axios.post('https://accounts.spotify.com/api/token', 
      querystring.stringify({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirect_uri
      }),
      {
        headers: {
          'Authorization': 'Basic ' + Buffer.from(client_id + ':' + client_secret).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    access_token = response.data.access_token; // Store access token
    res.redirect('/generate-playlist'); // Redirect to playlist generation route
  } catch (error) {
    console.error('Error fetching token:', error);
    res.send('Error during authentication');
  }
});

// 3. Generate Random Playlist
app.get('/generate-playlist', async (req, res) => {
  try {
    // Fetch user's top tracks using the access token
    const topTracksResponse = await axios.get('https://api.spotify.com/v1/me/top/tracks', {
      headers: { 'Authorization': 'Bearer ' + access_token }
    });
    const topTracks = topTracksResponse.data.items;

    // Select random tracks for the playlist
    const randomTracks = topTracks.sort(() => 0.5 - Math.random()).slice(0, 10); // Select 10 random tracks
    const trackUris = randomTracks.map(track => track.uri);

    // Get user ID
    const userResponse = await axios.get('https://api.spotify.com/v1/me', {
      headers: { 'Authorization': 'Bearer ' + access_token }
    });
    const userId = userResponse.data.id;

    // Create a new playlist
    const playlistResponse = await axios.post(`https://api.spotify.com/v1/users/${userId}/playlists`, {
      name: 'Randomized Playlist based on your taste',
      public: false,
      description: 'A playlist generated based on your recent listening habits'
    }, {
      headers: { 'Authorization': 'Bearer ' + access_token }
    });
    const playlistId = playlistResponse.data.id;

    // Add tracks to the new playlist
    await axios.post(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
      uris: trackUris
    }, {
      headers: { 'Authorization': 'Bearer ' + access_token }
    });

    res.send('Playlist created successfully! Check your Spotify account.');
  } catch (error) {
    console.error('Error creating playlist:', error);
    res.send('Error creating playlist');
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
