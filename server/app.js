const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const querystring = require('querystring');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');


const playlistTitlesTxt = fs.readFileSync('playlistTitles.txt', 'utf8');

dotenv.config();

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));


// const openai = new OpenAI({apiKey: process.env.OPENAI_ALT_API_KEY});


const playlistTitles = '';


const client_id = process.env.SPOTIFY_CLIENT_ID;
const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
const redirect_uri = process.env.REDIRECT_URI;
const googleAPIKey = process.env.googleAIStudio_API_KEY;

let access_token = "";

// Route for Spotify login
app.get('/spotifyLogin', (req, res) => {
  const scopes = 'user-top-read playlist-modify-private';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scopes,
      redirect_uri: redirect_uri
    }));
});

// Spotify Callback
app.get('/callback', async (req, res) => {
  const code = req.query.code || null;

  try {
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
    access_token = response.data.access_token;
    // res.redirect('/generate-playlist');
    res.redirect('/curate-trending-playlist');
    

    // console.log(x, 'XKJBGKJF')
  } catch (error) {
    console.error('Error fetching token:', error);
    res.send('Error during authentication');
  }
});

// Generate Random Playlist
app.get('/generate-playlist', async (req, res) => {
  try {
    // 1. Fetch top tracks
    const topTracksResponse = await axios.get('https://api.spotify.com/v1/me/top/tracks', {
      headers: { 'Authorization': 'Bearer ' + access_token }
    });
    const topTracks = topTracksResponse.data.items;

    // 2. Select random tracks for the playlist
    const randomTracks = topTracks.sort(() => 0.5 - Math.random()).slice(0, 10); // Select 10 random tracks

    if (randomTracks.length === 0) {
        // res.redirect('/curate-trending-playlist');

        console.log('9999999999999999')
        return res.send('No top tracks available to create a playlist.');
    }

    const trackUris = randomTracks.map(track => track.uri);

    if (trackUris.length === 0) {
        return res.send('No tracks available to add to the playlist.');
     }

    // 3. Create a new playlist
    const userResponse = await axios.get('https://api.spotify.com/v1/me', {
      headers: { 'Authorization': 'Bearer ' + access_token }
    });
    const userId = userResponse.data.id;

    const playlistResponse = await axios.post(`https://api.spotify.com/v1/users/${userId}/playlists`, {
      name: 'Randomized Playlist based on your taste',
      public: false,
      description: 'A playlist generated based on your recent listening habits'
    }, {
      headers: { 'Authorization': 'Bearer ' + access_token }
    });
    const playlistId = playlistResponse.data.id;

    // 4. Add tracks to the playlist
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

app.get('/curate-trending-playlist', async (req, res) => {
    try {

        console.log('666666666666666666666')
      const genreCategoryIds = ['pop', 'hiphop', 'rnb'];
      let tracks = [];
  
      for (const genre of genreCategoryIds) {
        const playlistsResponse = await axios.get(`https://api.spotify.com/v1/browse/categories/${genre}/playlists`, {
          headers: { 'Authorization': 'Bearer ' + access_token }
        });
  
        const playlists = playlistsResponse.data.playlists.items;
        const randomPlaylist = playlists[Math.floor(Math.random() * playlists.length)];
  
        const playlistTracksResponse = await axios.get(`https://api.spotify.com/v1/playlists/${randomPlaylist.id}/tracks`, {
          headers: { 'Authorization': 'Bearer ' + access_token }
        });
  
        const genreTracks = playlistTracksResponse.data.items.map(item => item.track.uri).slice(0, 10);
        tracks = tracks.concat(genreTracks);
      }
  
      const randomizedTracks = tracks.sort(() => 0.5 - Math.random()).slice(0, 30);
  
      if (randomizedTracks.length === 0) {
        return res.send('No tracks available to create a playlist.');
      }


      const your_user_id = await getUserID(access_token);

      console.log(your_user_id, 'USER ID');



      const userPrompt = `Hello, consider yourself as the playlist editor of a top music streaming company.
                          you are curating a personal playlist for artists like beyonce, rema, kendrick, j cole, etc.
                          thoroughly study their state of mind through the available data on the internet and
                          give me title for one playlist that is made up of trending songs from the genres: rnb, pop, hip hop, lofi.
                          it should be aesthetically pleasing, quirky, minimal and also buzz worthy.
                          It should be urban and poetic.
                          It should contain a maximum of 30 characters.
                          every response should contain only one playlist title.
                          each response should be inspired by unique imagery and should sound nothing like the previously generated titles.
                          Please note that there shouldn't be any repetitions or combinations/permutations
                          of words from previous responses
                          in the playlist titles that you give me as responses.
                          Avoid redundancy at any cost.
                          You can take inspiration from twitter and other text platforms
                          that have such content widely available. every title should have "pt->" written before it,
                          and every title should be in a new line. and, please refer to all the
                          public user playlist names and inspirations available to come up with answers.
                          Thanks.`;
      let playlistTitle = await chatCompletionTextResult(userPrompt);

      let cleanTitle = playlistTitle.split('\n')[0];
      console.log(playlistTitle.split('\n')[0], 'PT')
  
      const playlistResponse = await axios.post(`https://api.spotify.com/v1/users/${your_user_id}/playlists`, {
        name: cleanTitle,
        public: false,
        description: 'A trending playlist curated from Pop, Hip-Hop, and R&B hits'
      }, {
        headers: { 'Authorization': 'Bearer ' + access_token }
      });

      // console.log(playlistResponse, '000000')
      const playlistId = playlistResponse.data.id;
  
      await axios.post(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
        uris: randomizedTracks
      }, {
        headers: { 'Authorization': 'Bearer ' + access_token }
      });
  
      return res.send(`Trending playlist created successfully! Check your Spotify account. link below:\n https://open.spotify.com/playlist/${playlistId}`);
    } catch (error) {
      console.error('Error curating playlist:', error);
      if (!res.headersSent) {
        return res.send('Error curating playlist');
      }
    }
  });


  app.get('/test-token', async (req, res) => {
    try {
      const response = await axios.get('https://api.spotify.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${access_token}`
        }
      });
      res.send(response.data);
    } catch (error) {
      console.error('Error with access token:', error);
      res.send('Invalid or expired access token.');
    }
  });


  async function getUserID(accessToken) {
    try {
      const response = await axios.get('https://api.spotify.com/v1/me', {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });
      console.log('Your Spotify User ID:', response.data.id);

      return response.data.id;
    } catch (error) {
      console.error('Error fetching user ID:', error.response.data || error.message);
    }
  }


app.get('/randomPlaylistTitleGenerator', async (req, res) => {
    try {

      // Example usage
      const userPrompt = `Hello, consider yourself as the playlist editor of a top music streaming company.
                          you are curating a personal playlist for artists like beyonce, rema, kendrick, j cole, etc.
                          thoroughly study their state of mind through the available data on the internet and
                          give me title for one playlist that is made up of trending songs from the genres: rnb, pop, hip hop, lofi.
                          it should be aesthetically pleasing, quirky, minimal and also buzz worthy.
                          It should be urban and poetic.
                          It should contain a maximum of 30 characters.
                          every response should contain only one playlist title.
                          each response should be inspired by unique imagery and should sound nothing like the previously generated titles.
                          Please note that there shouldn't be any repetitions or combinations/permutations
                          of words from previous responses
                          in the playlist titles that you give me as responses.
                          Avoid redundancy at any cost.
                          You can take inspiration from twitter and other text platforms
                          that have such content widely available. every title should have "pt->" written before it,
                          and every title should be in a new line. and, please refer to all the
                          public user playlist names and inspirations available to come up with answers.
                          Thanks.`;
      let playlistTitle = await chatCompletionTextResult(userPrompt);

      console.log(playlistTitle.split('\n')[0], 'PT')


      try {
        const data = fs.readFileSync('playlistTitles.txt', 'utf8');
        // console.log('File contents:', data);
      } catch (err) {
          console.error('Error reading file:', err);
      }


      const dataToAppend = '\n' + playlistTitle;
      try {
          fs.appendFileSync('playlistTitles.txt', dataToAppend, 'utf8');
          console.log('Data appended to file successfully!');
      } catch (err) {
          console.error('Error appending to file:', err);
      }



      
      res.send(playlistTitle);
    } catch (error) {
      console.error('Error with access token:', error);
      res.send('Invalid or expired access token.');
    }
  });


  async function chatCompletionTextResult(prompt){

    const genAI = new GoogleGenerativeAI(googleAPIKey);
    const model = genAI.getGenerativeModel({
                                              model: "gemini-1.5-pro",
                                              generationConfig: {
                                                maxOutputTokens: 222,
                                                temperature: 1,
                                              }
                                            });

    !prompt? prompt= "Write a story about a magic backpack.": '';

    const result = await model.generateContent(prompt);
    console.log(result.response.text(), result.response.text().split('\n')[0]);   
    return result.response.text();
  }



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

