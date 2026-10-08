# Import libraries
import requests
import json
import urllib.request
import shutil
import os

RAPIDAPI_KEY = 'Ask Alastair Jamieson'

hashtags = ['slowlorisforsale'] #all-hashtags ['スローロリス','นางอาย' ,'slowloris', '„Çπ„É≠„Éº„É≠„É™„Çπ','‡∏ô‡∏≤‡∏á‡∏≠‡∏≤‡∏¢']
headers = {'x-rapidapi-host': 'instagram85.p.rapidapi.com', 'x-rapidapi-key': f'{RAPIDAPI_KEY}'}

current_directory = os.getcwd()

for hashtag in hashtags:

    # Get Instagram posts with this hastag as JSON, via RapidAPI
    url = f'https://instagram85.p.rapidapi.com/tag/{hashtag}/feed'
    data = requests.request('GET', url, headers=headers)
    json_file = data.json()

    if json_file is None:
        print(f'Invalid data recieved from RapidAPI for #{hashtag}')
        continue

    print(f'Data received from RapidAPI for #{hashtag}')

    # Determine the folder to use for JSON and images
    path = os.path.join(current_directory, f'hashtags/{hashtag}')
    print(f'path: {path}')

    # Remove the directory (and old data), if it exists, the re-create an empty directory
    try:
        shutil.rmtree(path)
    except:
        print(f'Directory {hashtag} is new')

    os.mkdir(path)

    # Store the API response as JSON
    with open(f'{current_directory}/hashtags/{hashtag}/{hashtag}-page01.json', 'w') as f:

        f.write(json.dumps(json_file))
        print(f'Data stored as JSON for #{hashtag}')

    # Download the images from each Instagram post
    for post in json_file['data']:

        postShortCode = post['short_code']
        image_url = post['images']['thumbnail']
        image_filename = f'{current_directory}/hashtags/{hashtag}/{postShortCode}.jpg'

        urllib.request.urlretrieve(image_url, image_filename)
        print(f'Image recevied and stored for Insta post {postShortCode}')
