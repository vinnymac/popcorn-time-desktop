/**
 * Movie component that is responsible for playing movie
 */
import React, { Component, PropTypes } from 'react';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import { Link } from 'react-router';
import notie from 'notie';
import { getIdealTorrent } from '../../api/torrents/BaseTorrentProvider';
import Butter from '../../api/Butter';
import Torrent from '../../api/Torrent';
import CardList from '../card/CardList';
import Rating from '../card/Rating';
import Show from '../show/Show';
import {
  convertFromBuffer,
  startServer
} from '../../api/Subtitle';
import Player from '../../api/Player';


const defaultTorrent = {
  default: { quality: undefined, magnet: undefined, seeders: 0 },
  '1080p': { quality: undefined, magnet: undefined, seeders: 0 },
  '720p': { quality: undefined, magnet: undefined, seeders: 0 },
  '480p': { quality: undefined, magnet: undefined, seeders: 0 }
};

const initialState = {
  item: {
    images: { fanart: '' },
    runtime: {}
  },
  currentPlayer: 'Default',
  servingUrl: '',
  selectedSeason: 1,
  selectedEpisode: 1,
  episodes: [],
  seasons: [],
  season: [],
  episode: {},
  similarItems: [],
  fetchingTorrents: false,
  idealTorrent: defaultTorrent,
  torrent: defaultTorrent,
  dropdownOpen: false,
  similarIsLoading: false,
  metadataIsLoading: false,
  torrentInProgress: false,
  torrentProgress: 0
};

export default class Movie extends Component {

  static propTypes = {
    actions: PropTypes.object.isRequired,
    activeMode: PropTypes.string.isRequired,
    routeParams: PropTypes.object,
    itemId: PropTypes.string.isRequired,
    item: PropTypes.object.isRequired,
    similarIsLoading: PropTypes.bool.isRequired,
    similarItems: PropTypes.array.isRequired,
    metadataIsLoading: PropTypes.bool.isRequired,
    torrentInProgress: PropTypes.bool.isRequired,
    fetchingTorrents: PropTypes.bool.isRequired,
    dropdownOpen: PropTypes.bool.isRequired,

    servingUrl: PropTypes.string.isRequired,
    currentPlayer: PropTypes.string.isRequired,

    selectedSeason: PropTypes.number.isRequired,
    selectedEpisode: PropTypes.number.isRequired,
    seasons: PropTypes.array.isRequired,
    episodes: PropTypes.array.isRequired,

    idealTorrent: PropTypes.object.isRequired,
    torrent: PropTypes.object.isRequired
  };

  static defaultProps = {
    activeMode: 'movies',
    itemId: '',
    ...initialState
  };

  initialState = initialState;

  defaultTorrent = defaultTorrent;

  constructor(props) {
    super(props);

    this.butter = new Butter();
    this.torrent = new Torrent();
    this.player = new Player();

    this.toggle = this.toggle.bind(this);
    this.subtitleServer = startServer();
  }

  /**
   * Check which players are available on the system
   */
  setPlayer(currentPlayer) {
    this.props.actions.setCurrentPlayer(currentPlayer);
  }

  toggle() {
    this.props.actions.setProp('dropdownOpen', !this.props.dropdownOpen);
  }

  componentDidMount() {
    const { itemId } = this.props.params;
    console.log(itemId);
    this.props.actions.setProp('itemId', itemId);

    this.getAllData(itemId);

    // this.getAllData(itemId);
    // this.props.actions.mergeProp({
    //   ...this.initialState,
    //   itemId,
    //   dropdownOpen: false,
    //   currentPlayer: 'Default'
    // });
  }

  componentWillUnmount() {
    this.props.actions.setInitialState();
    this.stopTorrent();
  }

  componentWillReceiveProps(nextProps) {
    console.log(this.props.params.itemId, nextProps.itemId, this.props.itemId);

    // if (this.props.params.itemId === nextProps.itemId) {
    //   if (this.props.itemId === this.props.params.itemId) {
    //     return;
    //   }
    // }

    // this.getAllData(nextProps.itemId);

    // if (this.props.params.itemId !== nextProps.itemId) {
    //   this.getAllData(nextProps.itemId);
    //   return;
    // }
    //
    // this.stopTorrent();
    // this.getAllData(nextProps.itemId);
  }

  getAllData(itemId: string) {
    // this.props.actions.setInitialState();

    if (this.props.activeMode === 'shows') {
      this.getShowData(
        'seasons',
        itemId,
        this.props.selectedSeason,
        this.props.selectedEpisode
      );
    }

    this.getItem(itemId).then(item => this.getTorrent(itemId, item.title, 1, 1));
    this.getSimilar(itemId);
  }

  async getShowData(type: string, imdbId: string, season: number, episode: number) {
    switch (type) {
      case 'seasons':
        this.props.actions.mergeProp({ seasons: [], episodes: [], episode: {} });
        this.props.actions.mergeProp({
          seasons: await this.butter.getSeasons(imdbId),
          episodes: await this.butter.getSeason(imdbId, 1),
          episode: await this.butter.getEpisode(imdbId, 1, 1)
        });
        break;
      case 'episodes':
        this.props.actions.mergeProp({ episodes: [], episode: {} });
        this.props.actions.mergeProp({
          episodes: await this.butter.getSeason(imdbId, season),
          episode: await this.butter.getEpisode(imdbId, season, 1)
        });
        break;
      case 'episode':
        this.props.actions.mergeProp({ episode: {} });
        this.props.actions.mergeProp({
          episode: await this.butter.getEpisode(imdbId, season, episode)
        });
        break;
      default:
        throw new Error('Invalid getShowData() type');
    }
  }

  /**
   * Get the details of a movie using the butter api
   */
  async getItem(imdbId) {
    this.props.actions.setLoadingStatus('metadataIsLoading', true);

    const item = await (() => {
      switch (this.props.activeMode) {
        case 'movies':
          return this.butter.getMovie(imdbId);
        case 'shows':
          return this.butter.getShow(imdbId);
        default:
          throw new Error('Active mode not found');
      }
    })();

    console.log(item);

    this.props.actions.setLoadingStatus('metadataIsLoading', false);
    this.props.actions.setItem(item);

    return item;
  }

  async getTorrent(imdbId, title, season, episode) {
    this.props.actions.mergeProp({
      fetchingTorrents: true,
      idealTorrent: this.defaultTorrent,
      torrent: this.defaultTorrent
    });

    try {
      const { torrent, idealTorrent } = await (async() => {
        switch (this.props.activeMode) {
          case 'movies': {
            const _torrent = await this.butter.getTorrent(imdbId, this.props.activeMode, {
              searchQuery: title
            });
            return {
              torrent: _torrent,
              idealTorrent: _torrent
            };
          }
          case 'shows': {
            if (process.env.FLAG_SEASON_COMPLETE === 'true') {
              const [shows, seasonComplete] = await Promise.all([
                this.butter.getTorrent(imdbId, this.props.activeMode, {
                  season,
                  episode,
                  searchQuery: title
                }),
                this.butter.getTorrent(imdbId, 'season_complete', {
                  season,
                  searchQuery: title
                })
              ]);

              return {
                torrent: {
                  '1080p': getIdealTorrent([shows['1080p'], seasonComplete['1080p']]),
                  '720p': getIdealTorrent([shows['720p'], seasonComplete['720p']]),
                  '480p': getIdealTorrent([shows['480p'], seasonComplete['480p']])
                },

                idealTorrent: getIdealTorrent([
                  shows['1080p'] || this.defaultTorrent,
                  shows['720p'] || this.defaultTorrent,
                  shows['480p'] || this.defaultTorrent,
                  seasonComplete['1080p'] || this.defaultTorrent,
                  seasonComplete['720p'] || this.defaultTorrent,
                  seasonComplete['480p'] || this.defaultTorrent
                ])
              };
            }

            return {
              torrent: await this.butter.getTorrent(imdbId, this.props.activeMode, {
                season,
                episode,
                searchQuery: title
              }),

              idealTorrent: getIdealTorrent([
                torrent['1080p'] || this.defaultTorrent,
                torrent['720p'] || this.defaultTorrent,
                torrent['480p'] || this.defaultTorrent
              ])
            };
          }
          default:
            throw new Error('Invalid active mode');
        }
      })();

      if (idealTorrent.quality === 'poor') {
        notie.alert(2, 'Slow torrent, low seeder count', 1);
      }

      this.props.actions.mergeProp({
        idealTorrent,
        fetchingTorrents: false,
        torrent: {
          '1080p': torrent['1080p'] || this.defaultTorrent,
          '720p': torrent['720p'] || this.defaultTorrent,
          '480p': torrent['480p'] || this.defaultTorrent
        }
      });
    } catch (error) {
      console.log(error);
    }
  }

  async getSimilar(imdbId) {
    this.props.actions.setLoadingStatus('similarIsLoading', true);

    try {
      const similarItems = await this.butter.getSimilar(this.props.activeMode, imdbId);

      this.props.actions.mergeProp({
        similarItems
      });
      this.props.actions.setLoadingStatus('similarIsLoading', false);
    } catch (error) {
      console.log(error);
    }
  }

  stopTorrent() {
    this.torrent.destroy();
    this.player.destroy();
    this.props.actions.setLoadingStatus('torrentInProgress', false);

    if (process.env.NODE_ENV === 'development') {
      clearInterval(this.torrentInfoInterval);
    }
  }

  selectShow(type, selectedSeason, selectedEpisode = 1) {
    switch (type) {
      case 'episodes':
        this.props.actions.mergeProp({ selectedSeason });
        this.getShowData('episodes', this.props.item.id, selectedSeason);
        this.selectShow('episode', selectedSeason, 1);
        break;
      case 'episode':
        this.props.actions.mergeProp({ selectedSeason, selectedEpisode });
        this.getShowData('episode', this.props.item.id, selectedSeason, selectedEpisode);
        this.getTorrent(this.props.item.id, this.props.item.title, selectedSeason, selectedEpisode);
        break;
      default:
        throw new Error('Invalid selectShow() type');
    }
  }

  /**
   * 1. Retrieve list of subtitles
   * 2. If the torrent has subtitles, get the subtitle buffer
   * 3. Convert the buffer (srt) to vtt, save the file to a tmp dir
   * 4. Serve the file through http
   * 5. Override the default subtitle retrieved from the API
   */
  async getSubtitles(subtitleTorrentFile = {}, activeMode, item) {
    // Retrieve list of subtitles
    const subtitles = await this.butter.getSubtitles(
      item.imdbId,
      subtitleTorrentFile.name,
      subtitleTorrentFile.length,
      {
        activeMode
      }
    );

    if (!subtitleTorrentFile) {
      return subtitles;
    }

    const { filename, port } = await new Promise((resolve, reject) => {
      subtitleTorrentFile.getBuffer((err, srtSubtitleBuffer) => {
        if (err) reject(err);
        // Convert to vtt, get filename
        resolve(convertFromBuffer(srtSubtitleBuffer));
      });
    });

    // Override the default subtitle
    const mergedResults = subtitles.map(subtitle => (
      subtitle.default === true
        ? {
          ...subtitle,
          src: `http://localhost:${port}/${filename}`
        }
        : subtitle
    ));

    return mergedResults;
  }

  async startTorrent(magnet, activeMode) {
    if (this.props.torrentInProgress) {
      this.stopTorrent();
    }

    this.props.actions.setServingUrl(undefined);
    this.props.actions.setLoadingStatus('torrentInProgress', true);

    const metadata = {
      activeMode,
      season: this.props.selectedSeason,
      episode: this.props.selectedEpisode
    };

    const formats = [
      ...Player.experimentalPlaybackFormats,
      ...Player.nativePlaybackFormats
    ];

    this.torrent.start(magnet, metadata, formats, async (servingUrl,
                                                          file,
                                                          files,
                                                          torrent,
                                                          subtitle
                                                        ) => {
      console.log('serving at:', servingUrl);
      this.props.actions.setServingUrl(servingUrl);

      const filename = file.name;
      const subtitles = subtitle && process.env.FLAG_SUBTITLES === 'true'
                          ? await this.getSubtitles(
                              subtitle,
                              this.props.activeMode,
                              this.props.item
                            )
                          : [];

      switch (this.props.currentPlayer) {
        case 'VLC':
          return this.player.initVLC(servingUrl);
        case 'Default':
          if (Player.isFormatSupported(filename, Player.nativePlaybackFormats)) {
            this.player.initPlyr(servingUrl, {
              poster: this.props.item.images.fanart.full,
              tracks: subtitles
            });
          } else if (Player.isFormatSupported(filename, [
            ...Player.nativePlaybackFormats,
            ...Player.experimentalPlaybackFormats
          ])) {
            notie.alert(2, 'The format of this video is not playable', 2);
            console.warn(`Format of filename ${filename} not supported`);
            console.warn('Files retrieved:', files);
          }
          break;
        default:
          console.error('Invalid player');
          break;
      }

      return torrent;
    });
  }

  render() {
    return (
      <div className="container">
        <div className="row">
          <div className="col-xs-12">
            <div className="Movie">
              <Link to="/">
                <button
                  className="btn btn-info ion-android-arrow-back"
                  onClick={this.stopTorrent.bind(this)}
                >
                  Back
                </button>
              </Link>
              <span>
                <button
                  onClick={
                    this.startTorrent.bind(
                      this,
                      this.props.idealTorrent.magnet,
                      this.props.idealTorrent.method,
                      this.props.item
                    )
                  }
                  disabled={!this.props.idealTorrent.quality}
                >
                  Start Ideal Torrent
                </button>
              </span>
              {process.env.FLAG_MANUAL_TORRENT_SELECTION === 'true' ?
                <span>
                  <button
                    onClick={
                      this.startTorrent.bind(
                        this,
                        this.props.torrent['1080p'].magnet,
                        this.props.torrent['1080p'].method,
                        this.props.item
                      )
                    }
                    disabled={!this.props.torrent['1080p'].quality}
                  >
                    Start 1080p -- {this.props.torrent['1080p'].seeders} seeders
                  </button>
                  <button
                    onClick={
                      this.startTorrent.bind(
                        this,
                        this.props.torrent['720p'].magnet,
                        this.props.torrent['720p'].method,
                        this.props.item
                      )
                    }
                    disabled={!this.props.torrent['720p'].quality}
                  >
                    Start 720p -- {this.props.torrent['720p'].seeders} seeders
                  </button>
                  {this.props.activeMode === 'shows' ?
                    <button
                      onClick={
                        this.startTorrent.bind(
                          this,
                          this.props.torrent['480p'].magnet,
                          this.props.torrent['480p'].method,
                          this.props.item
                        )
                      }
                      disabled={!this.props.torrent['480p'].quality}
                    >
                      Start 480p -- {this.props.torrent['480p'].seeders} seeders
                    </button>
                    :
                    null}
                </span>
                :
                null}
              <span>
                <a>
                  <strong>
                    Torrent status: {this.props.idealTorrent.health || ''}
                  </strong>
                </a>
              </span>
              <h1 id="title">
                {this.props.item.title}
              </h1>
              <h5>
                Year: {this.props.item.year}
              </h5>
              <h6 id="genres">
                Genres: {this.props.item.genres
                            ? this.props.item.genres.map(genre => `${genre}, `)
                            : null}
              </h6>
              <h5 id="runtime">
                Length: {this.props.item.runtime.full}
              </h5>
              <h6 id="summary">
                {this.props.item.summary}
              </h6>
              {this.props.item.rating ?
                <div>
                  <Rating rating={this.props.item.rating} />
                </div>
                :
                null}
              <h3>
                {!this.props.servingUrl && this.props.torrentInProgress
                    ? 'Loading torrent...'
                    : null}
              </h3>
              <h3>
                {this.props.fetchingTorrents
                    ? 'Fetching torrents...'
                    : null}
              </h3>

              <div className="row">
                <div className="col-xs-12">
                  <Dropdown isOpen={this.props.dropdownOpen} toggle={this.toggle}>
                    <DropdownToggle caret>
                      {this.props.currentPlayer || 'Default'}
                    </DropdownToggle>
                    <DropdownMenu>
                      <DropdownItem header>Select Player</DropdownItem>
                      <DropdownItem
                        onClick={this.setPlayer.bind(this, 'Default')}
                      >
                        Default
                      </DropdownItem>
                      <DropdownItem
                        onClick={this.setPlayer.bind(this, 'VLC')}
                      >
                        VLC
                      </DropdownItem>
                    </DropdownMenu>
                  </Dropdown>
                </div>
              </div>


              {this.props.item.certification
                  ? <div className="certification">{this.props.item.certification}</div>
                  : null}

              {this.props.activeMode === 'shows' ?
                <Show
                  selectShow={this.selectShow.bind(this)}
                  seasons={this.props.seasons}
                  episodes={this.props.episodes}
                  selectedSeason={this.props.selectedSeason}
                  selectedEpisode={this.props.selectedEpisode}
                />
                :
                null}
              <div className="plyr">
                <video controls poster={this.props.item.images.fanart.full} />
              </div>
            </div>
          </div>
          <div className="col-xs-12">
            <h3 className="text-center">Similar</h3>
            <CardList
              items={this.props.similarItems}
              metadataIsLoading={this.props.similarIsLoading}
              isFinished={this.props.similarIsLoading}
            />
          </div>
        </div>
      </div>
    );
  }
}
