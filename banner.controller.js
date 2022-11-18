const Sequelize = require('sequelize');
const { bannerService } = require('../services');
const db = require('../../models/index');
const axios = require('axios');

const { Op } = Sequelize;

const add = async (req, res) => {
  try {
    if (req.jwt.claims.groups.includes(req.body.group)) {
      const data = await bannerService.create(req.body);
      res.status(200).send({ status: true, message: 'Banner created successfully', data });
    } else {
      res.status(401).send({ message: 'unauthorized' });
    }
  } catch (err) {
    res.status(500).send({ status: false, message: err?.message });
  }
};

const getId = async (req, res) => {
  try {
    const data = await bannerService.getById(req.params.id);
    if (!data) {
      res.status(404).send({ status: false, message: 'Banner Data not found' });
      return;
    }
    if (data.group && req.jwt.claims.groups.includes(data.group)) {
      res.status(200).send({ status: true, data });
    } else {
      res.status(401).send({ message: 'unauthorized' });
    }
  } catch (err) {
    res.status(500).send({ status: false, message: err?.message });
  }
};

const updatebanner = async (req, res) => {
  try {
    if (req.jwt.claims.groups.includes(req.body.group)) {
      const dataget = await bannerService.getById(req.params.id);
      if (!dataget) {
        res.status(404).send({ status: false, message: 'Banner Data not found' });
        return;
      }
      if (dataget.group === req.body.group) {
        await bannerService.updateById(req.params.id, req.body);
        res.status(200).send({ message: 'Banner updated succesfully' });
      } else {
        res.status(500).send({ message: 'Something went wrong' });
      }
    } else {
      res.status(401).send({ message: 'unauthorized' });
    }
  } catch (err) {
    res.status(500).send({ status: false, message: err?.message });
  }
};

const drop = async (req, res) => {
  try {
    const dataget = await bannerService.getById(req.params.id);
    if (dataget?.group && req.jwt.claims.groups.includes(dataget.group)) {
      const data = await bannerService.dropId(req.params.id);
      if (!data) {
        res.status(404).send({ status: false, message: 'Banner not Found' });
        return;
      }
      res.status(200).send({ status: true, message: 'Banner deleted successfully' });
    } else {
      res.status(200).send({ status: true, message: 'Unauthorized' });
    }
  } catch (err) {
    res.status(500).send({ status: false, message: err?.message });
  }
};

const findAll = async (req, res) => {
  try {
    const todaybanner = await bannerService.getAll(req.body);
    const headers = {};
    const auth = {
      username: '',
      password: '',
    };
    if (req.query.today === 'true') {
      let result = todaybanner.filter((data) => data.banner_type === 2);
      let customResult = todaybanner.filter((data) => data.banner_type === 1);
      const finalData = await Promise.allSettled(
        result.map(async (data) => {
          if (data.endpoint_tokentype === 1) {
            auth['username'] = data.username;
            auth['password'] = data.password;
          } else {
            headers['Authorization'] = data.endpoint_token;
          }
          const resp = await axios({
            url: data.endpoint_url,
            method: data.endpoint_type,
            headers: headers,
            auth: auth,
            timeout: 5000,
          });
          Object.entries(resp.data).forEach(([key, value]) => {
            if (typeof value !== 'object') {
              if (data.content.indexOf(`${key}`) != -1) {
                data.content = data.content.replaceAll(`{{${key}}}`, value);
              }
            }
          });
          return data;
        })
      );
      const successfulPromises = finalData.filter((p) => p.status === 'fulfilled');

      const fulfilledValue = successfulPromises.map((p) => p.value);

      const finalResult = fulfilledValue.concat(customResult);

      const homebanner = finalResult.map(
        ({
          name,
          banner_type,
          status,
          background_image,
          content,
          group,
          start_date,
          end_date,
          createdAt,
          updatedAt,
          order_number,
        }) => ({
          name,
          banner_type,
          status,
          background_image,
          content,
          group,
          start_date,
          end_date,
          createdAt,
          updatedAt,
          order_number,
        })
      );

      res.send({ status: true, message: 'todays banner', homebanner });
      return;
    }
  } catch (err) {
    res.status(500).send({ status: false, message: err?.message });
  }
};

const findAllSecure = (req, res) => {
  const { pageNo = 1, page_size: limit = 10, search, type, status } = req.query;
  let condition = null;

  if (search && type && status) {
    condition = {
      [Op.and]: [
        { name: { [Op.iLike]: `%${search}%` } },
        { banner_type: type },
        { status },
        { group: { [Op.in]: req.jwt.claims.groups } },
      ],
    };
  } else if (search) {
    condition = { [Op.and]: [{ name: { [Op.iLike]: `%${search}%` } }, { group: { [Op.in]: req.jwt.claims.groups } }] };
  } else if (type) {
    condition = { [Op.and]: [{ banner_type: type }, { group: { [Op.in]: req.jwt.claims.groups } }] };
  } else if (status) {
    condition = { [Op.and]: [{ status }, { group: { [Op.in]: req.jwt.claims.groups } }] };
  } else {
    condition = { group: { [Op.in]: req.jwt.claims.groups } };
  }
  const offset = (pageNo - 1) * limit;
  db.banners
    .findAndCountAll({ where: condition, order: [['updatedAt', 'DESC']], limit, offset })
    .then((data) => {
      const { count: totalbanners, rows: banners } = data;
      const totalPageCount = Math.ceil(totalbanners / limit);
      res.send({ totalbanners, totalPageCount, pageNo, page_size: limit, banners });
    })
    .catch((err) => {
      res.status(500).send({
        message: err.message || 'Some error occurred while retrieving tutorials.',
      });
    });
};

module.exports = {
  add,
  updatebanner,
  getId,
  drop,
  findAllSecure,
  findAll,
};
