# autohaus

This is the website for autohaus. 

# Editing dates
We aren't using a backend dates are stored in `/src/events.ts`. 
New events can be added freely, fields are defined in the file as type. 
NOTE: date and name are used to create a hash and thus have to be unique together.

Only the dates that are after yesterday are being shown. 


In order to run the project:

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

# Deploying to github pages
In order to deploy the git remote 
```
gh-pages        https://github.com/autohaus-heidelberg/autohaus-heidelberg.github.io (push)
```
has to be set.


```sh
npm run deploy
```