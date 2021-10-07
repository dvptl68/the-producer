import os
import discord
from dotenv import load_dotenv

load_dotenv()
TOKEN = os.getenv('DISCORD_TOKEN')

class CustomClient(discord.Client):

  async def on_message(message):

    if message.author == client.user:
      return

    await message.channel.send('Received message')

client = CustomClient()
client.run(TOKEN)
