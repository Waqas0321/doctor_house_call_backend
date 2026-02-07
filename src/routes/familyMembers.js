const express = require('express');
const router = express.Router();
const {
  getFamilyMembers,
  getFamilyMember,
  createFamilyMember,
  updateFamilyMember,
  deleteFamilyMember
} = require('../controllers/familyMemberController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getFamilyMembers)
  .post(createFamilyMember);

router.route('/:id')
  .get(getFamilyMember)
  .put(updateFamilyMember)
  .delete(deleteFamilyMember);

module.exports = router;
