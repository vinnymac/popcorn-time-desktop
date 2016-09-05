import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import * as ItemActions from '../actions/itemPageActions';
import Movie from '../components/movie/Movie';


function mapStateToProps(state) {
  return {
    activeMode: state.itemPageReducer.activeMode,
    activeModeOptions: state.itemPageReducer.activeModeOptions,
    actions: state.itemPageReducer.actions,
    itemId: state.itemPageReducer.itemId,
    item: state.itemPageReducer.item,
    similarIsLoading: state.itemPageReducer.similarIsLoading,
    similarItems: state.itemPageReducer.similarItems,
    metadataIsLoading: state.itemPageReducer.metadataIsLoading,
    torrentInProgress: state.itemPageReducer.torrentInProgress,
    fetchingTorrents: state.itemPageReducer.fetchingTorrents,
    dropdownOpen: state.itemPageReducer.dropdownOpen,
    servingUrl: state.itemPageReducer.servingUrl,
    currentPlayer: state.itemPageReducer.currentPlayer,
    selectedSeason: state.itemPageReducer.selectedSeason,
    selectedEpisode: state.itemPageReducer.selectedEpisode,
    seasons: state.itemPageReducer.seasons,
    episodes: state.itemPageReducer.episodes,
    idealTorrent: state.itemPageReducer.idealTorrent,
    torrent: state.itemPageReducer.torrent
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(ItemActions, dispatch)
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(Movie);
