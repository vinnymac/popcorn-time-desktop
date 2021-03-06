/**
 * Movie component that is responsible for playing movie
 */
import React, { Component, PropTypes } from 'react';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';
import { Link } from 'react-router';
import notie from 'notie';
import { exec } from 'child_process';
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


export default class Movie extends Component {

  defaultTorrent: Object = {
    default: { quality: undefined, magnet: undefined, seeders: 0 },
    '1080p': { quality: undefined, magnet: undefined, seeders: 0 },
    '720p': { quality: undefined, magnet: undefined, seeders: 0 },
    '480p': { quality: undefined, magnet: undefined, seeders: 0 }
  };

  initialState: Object = {
    item: {
      images: { fanart: '' },
      runtime: {}
    },
    selectedSeason: 1,
    selectedEpisode: 1,
    seasons: [],
    season: [],
    episode: {},
    fetchingTorrents: false,
    idealTorrent: this.defaultTorrent,
    torrent: this.defaultTorrent,
    similarLoading: false,
    metadataLoading: false,
    torrentInProgress: false,
    torrentProgress: 0
  };

  constructor(props: Object) {
    super(props);

    this.butter = new Butter();
    this.torrent = new Torrent();
    this.player = new Player();

    this.toggle = this.toggle.bind(this);
    this.state = this.initialState;

    this.subtitleServer = startServer();
  }

  /**
   * Check which players are available on the system
   */
  setPlayer(player: string) {
    this.setState({ currentPlayer: player });
  }

  toggle() {
    this.setState({
      dropdownOpen: !this.state.dropdownOpen
    });
  }

  componentDidMount() {
    this.getAllData(this.props.itemId);

    this.setState({ // eslint-disable-line
      ...this.initialState,
      dropdownOpen: false,
      currentPlayer: 'Default'
    });
  }

  componentWillUnmount() {
    this.stopTorrent();
  }

  componentWillReceiveProps(nextProps: Object) {
    this.stopTorrent();

    this.setState({
      ...this.initialState
    });

    this.getAllData(nextProps.itemId);
  }

  getAllData(itemId: string) {
    this.setState(this.initialState, () => {
      if (this.props.activeMode === 'shows') {
        this.getShowData(
          'seasons', itemId, this.state.selectedSeason, this.state.selectedEpisode
        );
      }
    });

    return Promise.all([
      this.getItem(itemId)
        .then((item: Object) => this.getTorrent(itemId, item.title, 1, 1)),
      this.getSimilar(itemId)
    ]);
  }

  async getShowData(type: string, imdbId: string, season: number, episode: number) {
    switch (type) {
      case 'seasons':
        this.setState({ seasons: [], episodes: [], episode: {} });
        this.setState({
          seasons: await this.butter.getSeasons(imdbId),
          episodes: await this.butter.getSeason(imdbId, 1),
          episode: await this.butter.getEpisode(imdbId, 1, 1)
        });
        break;
      case 'episodes':
        this.setState({ episodes: [], episode: {} });
        this.setState({
          episodes: await this.butter.getSeason(imdbId, season),
          episode: await this.butter.getEpisode(imdbId, season, 1)
        });
        break;
      case 'episode':
        this.setState({ episode: {} });
        this.setState({
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
  async getItem(imdbId: string) {
    this.setState({ metadataLoading: true });

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

    this.setState({ item, metadataLoading: false });

    return item;
  }

  async getTorrent(imdbId: string, title: string, season: number, episode: number) {
    this.setState({
      fetchingTorrents: true,
      idealTorrent: this.defaultTorrent,
      torrent: this.defaultTorrent
    });

    try {
      const { torrent, idealTorrent } = await (async () => {
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

      this.setState({
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

  async getSimilar(imdbId: string) {
    this.setState({ similarLoading: true });

    try {
      const similarItems = await this.butter.getSimilar(this.props.activeMode, imdbId);

      this.setState({
        similarItems,
        similarLoading: false,
        isFinished: true
      });
    } catch (error) {
      console.log(error);
    }
  }

  stopTorrent() {
    this.torrent.destroy();
    this.player.destroy();
    this.setState({ torrentInProgress: false });

    if (process.env.NODE_ENV === 'development') {
      clearInterval(this.torrentInfoInterval);
    }
  }

  selectShow(type: string, selectedSeason: number, selectedEpisode: number = 1) {
    switch (type) {
      case 'episodes':
        this.setState({ selectedSeason });
        this.getShowData('episodes', this.state.item.id, selectedSeason);
        this.selectShow('episode', selectedSeason, 1);
        break;
      case 'episode':
        this.setState({ selectedSeason, selectedEpisode });
        this.getShowData('episode', this.state.item.id, selectedSeason, selectedEpisode);
        this.getTorrent(this.state.item.id, this.state.item.title, selectedSeason, selectedEpisode);
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
  async getSubtitles(subtitleTorrentFile: Object = {}, activeMode: string, item: Object) {
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
    const mergedResults = subtitles.map((subtitle: Object) => (
      subtitle.default === true
        ? {
          ...subtitle,
          src: `http://localhost:${port}/${filename}`
        }
        : subtitle
    ));

    return mergedResults;
  }

  async startTorrent(magnet: string, activeMode: string) {
    if (this.state.torrentInProgress) {
      this.stopTorrent();
    }

    this.setState({
      servingUrl: undefined
    });

    this.setState({ torrentInProgress: true });

    const metadata = {
      activeMode,
      season: this.state.selectedSeason,
      episode: this.state.selectedEpisode
    };

    const formats = [
      ...Player.experimentalPlaybackFormats,
      ...Player.nativePlaybackFormats
    ];

    this.torrent.start(magnet, metadata, formats, async (servingUrl: string,
                                                          file: string,
                                                          files: string,
                                                          torrent: string,
                                                          subtitle: string
                                                        ) => {
      console.log('serving at:', servingUrl);
      this.setState({ servingUrl });

      const filename = file.name;
      const subtitles = subtitle && process.env.FLAG_SUBTITLES === 'true'
                          ? await this.getSubtitles(
                              subtitle,
                              this.props.activeMode,
                              this.state.item
                            )
                          : [];

      switch (this.state.currentPlayer) {
        case 'VLC':
          return this.player.initVLC(servingUrl);
        case 'Chromecast': {
          const { title } = this.state.item;
          const { full } = this.state.item.images.fanart;
          const command = [
            'node ./.tmp/Cast.js',
            `--url '${servingUrl}'`,
            `--title '${title}'`,
            `--image ${full}`
          ].join(' ');

          return exec(command, (_error, stdout, stderr) => {
            if (_error) {
              return console.error(`exec error: ${_error}`);
            }
            return [
              console.log(`stdout: ${stdout}`),
              console.log(`stderr: ${stderr}`)
            ];
          });
        }
        case 'Default':
          if (Player.isFormatSupported(filename, Player.nativePlaybackFormats)) {
            this.player.initPlyr(servingUrl, {
              poster: this.state.item.images.fanart.full,
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
    const torrentLoadingStatusStyle = { color: 'maroon' };

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
                      this.state.idealTorrent.magnet,
                      this.state.idealTorrent.method,
                      this.state.item
                    )
                  }
                  disabled={!this.state.idealTorrent.quality}
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
                        this.state.torrent['1080p'].magnet,
                        this.state.torrent['1080p'].method,
                        this.state.item
                      )
                    }
                    disabled={!this.state.torrent['1080p'].quality}
                  >
                    Start 1080p -- {this.state.torrent['1080p'].seeders} seeders
                  </button>
                  <button
                    onClick={
                      this.startTorrent.bind(
                        this,
                        this.state.torrent['720p'].magnet,
                        this.state.torrent['720p'].method,
                        this.state.item
                      )
                    }
                    disabled={!this.state.torrent['720p'].quality}
                  >
                    Start 720p -- {this.state.torrent['720p'].seeders} seeders
                  </button>
                  {this.props.activeMode === 'shows' ?
                    <button
                      onClick={
                        this.startTorrent.bind(
                          this,
                          this.state.torrent['480p'].magnet,
                          this.state.torrent['480p'].method,
                          this.state.item
                        )
                      }
                      disabled={!this.state.torrent['480p'].quality}
                    >
                      Start 480p -- {this.state.torrent['480p'].seeders} seeders
                    </button>
                    :
                    null}
                </span>
                :
                null}
              <span>
                <a>
                  <strong>
                    Torrent status: {this.state.idealTorrent.health || ''}
                  </strong>
                </a>
              </span>
              <h1 id="title">
                {this.state.item.title}
              </h1>
              <h5>
                Year: {this.state.item.year}
              </h5>
              <h6 id="genres">
                Genres: {this.state.item.genres
                            ? this.state.item.genres.map((genre: string) => `${genre}, `)
                            : null}
              </h6>
              <h5 id="runtime">
                Length: {this.state.item.runtime.full}
              </h5>
              <h6 id="summary">
                {this.state.item.summary}
              </h6>
              {this.state.item.rating ?
                <div>
                  <Rating rating={this.state.item.rating} />
                </div>
                :
                null}
              <h3 style={torrentLoadingStatusStyle}>
                {!this.state.servingUrl && this.state.torrentInProgress
                    ? 'Loading torrent...'
                    : null}
              </h3>
              <h3 style={torrentLoadingStatusStyle}>
                {this.state.fetchingTorrents
                    ? 'Fetching torrents...'
                    : null}
              </h3>

              <div className="row">
                <div className="col-xs-12">
                  <Dropdown isOpen={this.state.dropdownOpen} toggle={this.toggle}>
                    <DropdownToggle caret>
                      {this.state.currentPlayer || 'Default'}
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
                      {process.env.FLAG_CASTING === 'true'
                        ?
                        <DropdownItem
                          onClick={this.setPlayer.bind(this, 'Chromecast')}
                        >
                          Chromecast
                        </DropdownItem>
                        : null}
                    </DropdownMenu>
                  </Dropdown>
                </div>
              </div>


              {this.state.item.certification
                ? <div className="certification">{this.state.item.certification}</div>
                : null}

              {this.props.activeMode === 'shows' ?
                <Show
                  selectShow={this.selectShow.bind(this)}
                  seasons={this.state.seasons}
                  episodes={this.state.episodes}
                  selectedSeason={this.state.selectedSeason}
                  selectedEpisode={this.state.selectedEpisode}
                />
                :
                null}
              <div className="plyr">
                <video controls poster={this.state.item.images.fanart.full} />
              </div>
            </div>
          </div>
          <div className="col-xs-12">
            <h3 className="text-center">Similar</h3>
            <CardList
              items={this.state.similarItems}
              metadataLoading={this.state.similarLoading}
              isFinished={this.state.isFinished}
            />
          </div>
        </div>
      </div>
    );
  }
}

Movie.propTypes = {
  itemId: PropTypes.string.isRequired,
  activeMode: PropTypes.string.isRequired
};

Movie.defaultProps = {
  itemId: '',
  activeMode: 'movies'
};
