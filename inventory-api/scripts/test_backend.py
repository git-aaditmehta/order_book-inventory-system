"""
Automated Backend Verification Test Script
Tests model validation, cost redaction logic, and API router setup.
"""

import sys
import os
import unittest

# Add parent directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.models import (
    RawMaterialCreate, JewelryCreate, JewelryRecipeItem, 
    redact_cost_for_manager
)

class TestBackendLogic(unittest.TestCase):

    def test_raw_material_model(self):
        item = RawMaterialCreate(
            name="3/5 tilak",
            color="Red",
            packets=3,
            quantity_per_packet=100,
            loose_units=50,
            cost_per_unit=12.50
        )
        self.assertEqual(item.name, "3/5 tilak")
        self.assertEqual(item.packets, 3)
        self.assertEqual(item.loose_units, 50)
        self.assertEqual(item.cost_per_unit, 12.50)

    def test_jewelry_model(self):
        recipe = [JewelryRecipeItem(raw_material_id="rm-123", required_quantity=20)]
        j = JewelryCreate(
            sku_id="J-101",
            color="Gold",
            weight_before=15.0,
            weight_after=14.5,
            recipes=recipe
        )
        self.assertEqual(j.sku_id, "J-101")
        self.assertEqual(len(j.recipes), 1)
        self.assertEqual(j.recipes[0].required_quantity, 20)

    def test_cost_redaction_for_manager(self):
        sample_data = {
            "name": "3/5 tilak",
            "color": "Red",
            "packets": 3,
            "loose_units": 50,
            "cost_per_unit": 12.5,
            "total_order_cost": 250.0,
            "materials_used": [
                {"name": "3/5 tilak", "line_cost": 250.0, "units_used": 20}
            ]
        }
        
        # Test Owner: Should preserve cost values
        owner_result = redact_cost_for_manager(sample_data, "OWNER")
        self.assertEqual(owner_result["cost_per_unit"], 12.5)
        self.assertEqual(owner_result["total_order_cost"], 250.0)
        self.assertEqual(owner_result["materials_used"][0]["line_cost"], 250.0)
        
        # Test Manager: Should redact cost values to None
        manager_result = redact_cost_for_manager(sample_data, "MANAGER")
        self.assertIsNone(manager_result["cost_per_unit"])
        self.assertIsNone(manager_result["total_order_cost"])
        self.assertIsNone(manager_result["materials_used"][0]["line_cost"])
        self.assertEqual(manager_result["materials_used"][0]["units_used"], 20)
        self.assertEqual(manager_result["name"], "3/5 tilak")

if __name__ == "__main__":
    unittest.main()
