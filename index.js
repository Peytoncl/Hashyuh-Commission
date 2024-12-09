const { Client, GatewayIntentBits, EmbedBuilder, ActivityType } = require('discord.js');
const noblox = require('noblox.js');
const fs = require('fs');

const axios = require('axios');

// Load the data from the data file (data.json)
const dataFilePath = './data.json';

// Helper function to load data from the file
function loadData() {
  if (fs.existsSync(dataFilePath)) {
    const rawData = fs.readFileSync(dataFilePath);
    return JSON.parse(rawData);
  }
  
  return {}; // Return an empty object if the file doesn't exist
}

// Helper function to save data to the file
function saveData() {
  fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
}

// Load the initial data from the file
let data = loadData();

// Create a new Discord client
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

// Login to Discord
client.login(data.discordToken);

// Monitor the accounts every 20 seconds
let monitorAccountInterval;

let oldFriendRequests;

async function getCsrfToken(cookie) {
    try {
        const response = await axios.post(
            'https://auth.roblox.com/v1/logout',
            {}, // Empty body
            {
                headers: {
                    'Cookie': `.ROBLOSECURITY=${cookie}`,
                }
            }
        );
    } catch (error) {
        if (error.response && error.response.status === 403) {
            return error.response.headers['x-csrf-token'];
        }
        throw new Error('Failed to retrieve CSRF token.');
    }
}   

async function sendFriendRequest(cookie, userId) {
    const csrfToken = await getCsrfToken(cookie);
    const response = await axios.post(
        `https://friends.roblox.com/v1/users/${userId}/request-friendship`,
        {}, // Empty body
        {
            headers: {
                'Cookie': `.ROBLOSECURITY=${cookie}`,
                'x-csrf-token': csrfToken,
                'Content-Type': 'application/json',
            }
        }
    );
    console.log('Friend request sent:', response.data);
}

let currentFriendRequestHandler = null; // Variable to hold the current event handler

function startMonitoring(cookie, noblox) {
    // Notify the user
    message.channel.send(`**Started monitoring account with cookie:** ${cookie}`);

    // Remove the existing friend request listener, if any
    if (currentFriendRequestHandler) {
        noblox.off('onFriendRequest', currentFriendRequestHandler);
    }

    

    // Define the new handler as a named function
    currentFriendRequestHandler = function handleFriendRequest(data) {
        console.log(`Friend request received from: ${data}`);
        
        data.sender
    };

    // Attach the new handler to the event
    noblox.on('onFriendRequest', currentFriendRequestHandler);
}

// Command handling
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const args = message.content.split(' ');

  if (args[0] == "+help") {
    const helpEmbed = new EmbedBuilder()
            .setColor(0x0099FF) // Set the embed color
            .setTitle('**Friend Request Bot**')
            .setDescription('**DISCLAIMER:** Monitoring is currently not possible with the Roblox API. Use "**+send-friend-request (user id)**" to send friend requests on both accounts.')
            .addFields(
                { name: 'Invite Link', value: "[Here](https://discord.com/oauth2/authorize?client_id=1315149470295392298&permissions=3072&scope=bot)", inline: false },
                { name: '+monitor-account (cookie)', value: 'This is to set **account A** or the account that ***would*** be being monitored.', inline: false },
                { name: '+target-account (cookie)', value: 'This is to set **account B** or the account that ***would*** be monitoring account A for requests, then adding on this account.', inline: false },
                { name: '+send-friend-request (user id)', value: 'This command will add a **Roblox** ***user id*** on both **account A** and **account B**', inline: false }
            )

    // Send the embed
    message.channel.send({ embeds: [helpEmbed] });
  }

  // Monitor Account Command
  if (args[0] === '+monitor-account') {
    let cookie = args[1];
    if (!cookie) {
      if (data.monitorAccount?.cookie) {
        //message.channel.send('Monitoring this account: ' + data.monitorAccount.cookie);

        cookie = data.monitorAccount?.cookie;
      } else {
        message.channel.send('**No account is currently being monitored.**');

        return;
      }
    }

    if (data.monitorAccount?.cookie != cookie)
    {
        data.monitorAccount = { cookie };
        saveData();
    }
    
    const monitorCookie = data.monitorAccount?.cookie;

    await noblox.setCookie(monitorCookie);

    oldFriendRequests = await noblox.getFriendRequests({ sortOrder: 'Desc', limit: 100 });

    message.channel.send(`**Monitoring is currently not possible with the Roblox API. Use "+send-friend-request (user id)" to send friend requests on both accounts.':** ${monitorCookie}`);

    //startMonitoring(monitorCookie, noblox);
  }

  // Target Account Command
  if (args[0] === '+target-account') {
    const cookie = args[1];
    if (!cookie) {
      message.channel.send('**No target account cookie provided.**');
      return;
    }

    data.targetAccount = { cookie };
    saveData();

    message.channel.send(`**Target account set with cookie:** ${cookie}`);
  }

  // Send Friend Request Command
  if (args[0] === '+send-friend-request') {
    const userId = args[1];
    if (!userId) {
      message.channel.send('**Please provide a user ID to send a friend request.**');
      return;
    }

    if (!data.monitorAccount?.cookie || !data.targetAccount?.cookie) {
      message.channel.send('**You must have both a monitor account and a target account set.**');
      return;
    }

    try {

      console.log(userId);

      await noblox.setCookie(data.monitorAccount.cookie);

      console.log((await noblox.getAuthenticatedUser()).displayName);

      try
      {
        await sendFriendRequest(data.monitorAccount.cookie, Number(userId));
      }
      catch(error)
      {
        console.log(error);
      }

      await noblox.setCookie(data.targetAccount.cookie);

      console.log((await noblox.getAuthenticatedUser()).displayName);

      try
      {
        await sendFriendRequest(data.targetAccount.cookie, Number(userId));
      }
      catch(error)
      {
        console.log(error);
      }

      console.log(`Sent friend request to ${userId} from target account`);

      message.channel.send(`Sent friend request to ${userId} from both accounts`);

    } catch (error) {
      console.error('Error sending friend request:', error);
      message.channel.send('**Failed to send friend request.**');
    }
  }
});

// When the bot is ready
client.once('ready', () => {
  client.user.setActivity('+help', { type: ActivityType.Listening });

  console.log(`Logged in as ${client.user.tag}`);
});