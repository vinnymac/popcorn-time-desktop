/**
 * Card in the CardList component
 */

import React, { PropTypes } from 'react';
import { Link } from 'react-router';
import Rating from './Rating';


export default function Card(props) {
  const placeholder = '../../images/posterholder.png';

  const divStyle = {
    backgroundImage: `url(${props.image !== 'N/A' ? props.image : placeholder})`
  };

  return (
    <div className="Card">
      <Link to={`/item/${props.type}/${props.id}`}>
        <div className="Card--overlay-container" style={divStyle}>
          <div className="Card--overlay" />
        </div>
      </Link>
      <div>
        <Link className="Card--title" to={`/item/${props.type}/${props.id}`}>
          {props.title}
        </Link>
      </div>
      <div>
        {props.rating !== 'n/a' ?
          <Rating rating={props.rating} />
          :
          null
        }
      </div>
      {props.type === 'search' ?
        <div>
          {props.type}
        </div>
        :
        null
      }
      Kind: {props.type}
      <div className="Card--genres">
        {props.genres ? props.genres[0] : null}
      </div>
    </div>
  );
}

Card.propTypes = {
  title: PropTypes.string.isRequired,
  image: PropTypes.string,
  id: PropTypes.string,
  genres: PropTypes.array,
  rating: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.string
  ]),
  type: PropTypes.string.isRequired
};
