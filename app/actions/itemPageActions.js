export function setItem(item) {
  return {
    type: 'SET_ITEM',
    item
  };
}

export function setCurrentPlayer(currentPlayer) {
  return {
    type: 'SET_CURRENT_PLAYER',
    currentPlayer
  };
}

export function setServingUrl(servingUrl) {
  return {
    type: 'SET_SERVING_URL',
    servingUrl
  };
}

export function setLoadingStatus(statusName, isLoading) {
  return {
    type: 'SET_LOADING_STATUS',
    statusName,
    isLoading
  };
}

export function setInitialState() {
  return {
    type: 'SET_INITIAL_STATE'
  };
}

export function setTorrentProgress(torrentInProgress) {
  return {
    type: 'SET_TORRENT_PROGRESS',
    torrentInProgress
  };
}

export function setProp(propName, propValue) {
  return {
    type: 'SET_PROP',
    propName,
    propValue
  };
}

export function mergeProp(_) {
  return {
    type: 'MERGE_PROP',
    mergeProp: _
  };
}
